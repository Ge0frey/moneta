// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IConditionalVault} from "./interfaces/IConditionalVault.sol";
import {IMonetaAMM} from "./interfaces/IMonetaAMM.sol";
import {IMonetaFactory} from "./interfaces/IMonetaFactory.sol";
import {ITreasury} from "./interfaces/ITreasury.sol";
import {NotActive, NotResolved, UnknownTreasury, ZeroAmount} from "./types/MonetaErrors.sol";
import {Outcome, PermitArgs, Proposal, ProposalStatus} from "./types/MonetaTypes.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title MonetaRouter
/// @notice Stateless UX composition over the vault and AMM: one-click outcome trades, spot swaps, merges and
///         redemptions. Holds no funds between transactions and only ever moves `msg.sender`'s own assets.
contract MonetaRouter is ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    IMonetaFactory public immutable factory;
    IConditionalVault public immutable vault;
    IMonetaAMM public immutable amm;

    /// @dev Resolved addresses for one proposal's markets.
    struct Ctx {
        bytes32 conditionId;
        uint64 passPool;
        uint64 failPool;
        address token;
        address quote;
        address passToken;
        address failToken;
        address passQuote;
        address failQuote;
    }

    event OutcomeTraded(
        address indexed treasury,
        uint256 indexed proposalId,
        address indexed trader,
        bool pass,
        bool buy,
        uint256 amountIn,
        uint256 amountOut
    );
    event SpotTraded(
        address indexed treasury, address indexed trader, bool buy, uint256 amountIn, uint256 amountOut
    );
    event PositionsMerged(
        address indexed treasury,
        uint256 indexed proposalId,
        address indexed trader,
        uint256 tokenMerged,
        uint256 quoteMerged
    );
    event PositionsRedeemed(
        address indexed treasury,
        uint256 indexed proposalId,
        address indexed trader,
        uint256 tokenOut,
        uint256 quoteOut
    );

    constructor(IMonetaFactory factory_, IConditionalVault vault_, IMonetaAMM amm_) {
        factory = factory_;
        vault = vault_;
        amm = amm_;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Decision markets
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Bet on one world with USDC: split `quoteIn` into PASS/FAIL USDC, swap the chosen side's USDC for the
    ///         chosen side's token, return the other side's USDC. If the other world wins, that USDC redeems 1:1.
    function buyOutcome(
        address treasury,
        uint256 id,
        bool pass,
        uint256 quoteIn,
        uint256 minOut,
        PermitArgs calldata permit
    ) external nonReentrant returns (uint256 out) {
        if (quoteIn == 0) revert ZeroAmount();
        Ctx memory c = _ctx(treasury, id);
        _requireActive(treasury, id);

        _permit(c.quote, permit);
        IERC20(c.quote).safeTransferFrom(msg.sender, address(this), quoteIn);
        _approveMax(c.quote, address(vault), quoteIn);
        vault.split(c.conditionId, c.quote, quoteIn, address(this));

        out = amm.swap(pass ? c.passPool : c.failPool, false, quoteIn, minOut, msg.sender);
        IERC20(pass ? c.failQuote : c.passQuote).safeTransfer(msg.sender, quoteIn);
        emit OutcomeTraded(treasury, id, msg.sender, pass, true, quoteIn, out);
    }

    /// @notice Sell a side's token for that side's USDC, then merge with the caller's opposite-side USDC into real
    ///         USDC where possible (lossless). Leftover side-USDC is returned.
    function sellOutcome(address treasury, uint256 id, bool pass, uint256 tokenIn, uint256 minQuoteOut)
        external
        nonReentrant
        returns (uint256 usdcOut, uint256 sideQuoteLeft)
    {
        if (tokenIn == 0) revert ZeroAmount();
        Ctx memory c = _ctx(treasury, id);
        _requireActive(treasury, id);

        IERC20(pass ? c.passToken : c.failToken).safeTransferFrom(msg.sender, address(this), tokenIn);
        uint256 sideQuote =
            amm.swap(pass ? c.passPool : c.failPool, true, tokenIn, minQuoteOut, address(this));

        address otherQuote = pass ? c.failQuote : c.passQuote;
        usdcOut = Math.min(sideQuote, IERC20(otherQuote).balanceOf(msg.sender));
        if (usdcOut > 0) {
            IERC20(otherQuote).safeTransferFrom(msg.sender, address(this), usdcOut);
            vault.merge(c.conditionId, c.quote, usdcOut, msg.sender);
        }
        sideQuoteLeft = sideQuote - usdcOut;
        if (sideQuoteLeft > 0) {
            IERC20(pass ? c.passQuote : c.failQuote).safeTransfer(msg.sender, sideQuoteLeft);
        }
        emit OutcomeTraded(treasury, id, msg.sender, pass, false, tokenIn, sideQuote);
    }

    /// @notice Before the verdict: merge every matched PASS/FAIL pair the caller holds back into the underlying.
    function mergeAll(address treasury, uint256 id)
        external
        nonReentrant
        returns (uint256 tokenMerged, uint256 quoteMerged)
    {
        Ctx memory c = _ctx(treasury, id);
        tokenMerged = _mergePair(c.conditionId, c.token, c.passToken, c.failToken);
        quoteMerged = _mergePair(c.conditionId, c.quote, c.passQuote, c.failQuote);
        emit PositionsMerged(treasury, id, msg.sender, tokenMerged, quoteMerged);
    }

    /// @notice After the verdict: redeem all of the caller's conditional tokens of a proposal for the winning side.
    function redeemAll(address treasury, uint256 id)
        external
        nonReentrant
        returns (uint256 tokenOut, uint256 quoteOut)
    {
        Ctx memory c = _ctx(treasury, id);
        if (vault.outcomeOf(c.conditionId) == Outcome.Unresolved) revert NotResolved();
        tokenOut = _redeemPair(c.conditionId, c.token, c.passToken, c.failToken);
        quoteOut = _redeemPair(c.conditionId, c.quote, c.passQuote, c.failQuote);
        emit PositionsRedeemed(treasury, id, msg.sender, tokenOut, quoteOut);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Spot
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Buy (USDC → token) or sell (token → USDC) on a project's spot pool.
    function swapSpot(
        address treasury,
        bool buy,
        uint256 amountIn,
        uint256 minOut,
        PermitArgs calldata permit
    ) external nonReentrant returns (uint256 out) {
        if (!factory.isTreasury(treasury)) revert UnknownTreasury();
        if (amountIn == 0) revert ZeroAmount();
        address tokenIn = buy ? ITreasury(treasury).quote() : ITreasury(treasury).token();
        _permit(tokenIn, permit);
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        _approveMax(tokenIn, address(amm), amountIn);
        out = amm.swap(ITreasury(treasury).spotPoolId(), !buy, amountIn, minOut, msg.sender);
        emit SpotTraded(treasury, msg.sender, buy, amountIn, out);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────────────────────────────────

    function _ctx(address treasury, uint256 id) private view returns (Ctx memory c) {
        if (!factory.isTreasury(treasury)) revert UnknownTreasury();
        Proposal memory p = ITreasury(treasury).proposal(id);
        if (p.conditionId == bytes32(0)) revert NotActive();
        c.conditionId = p.conditionId;
        c.passPool = p.passPoolId;
        c.failPool = p.failPoolId;
        c.token = ITreasury(treasury).token();
        c.quote = ITreasury(treasury).quote();
        (c.passToken, c.failToken) = vault.tokensOf(p.conditionId, c.token);
        (c.passQuote, c.failQuote) = vault.tokensOf(p.conditionId, c.quote);
    }

    function _requireActive(address treasury, uint256 id) private view {
        if (ITreasury(treasury).proposal(id).status != ProposalStatus.Active) revert NotActive();
    }

    function _mergePair(bytes32 conditionId, address collateral, address passT, address failT)
        private
        returns (uint256 m)
    {
        m = Math.min(IERC20(passT).balanceOf(msg.sender), IERC20(failT).balanceOf(msg.sender));
        if (m == 0) return 0;
        IERC20(passT).safeTransferFrom(msg.sender, address(this), m);
        IERC20(failT).safeTransferFrom(msg.sender, address(this), m);
        vault.merge(conditionId, collateral, m, msg.sender);
    }

    function _redeemPair(bytes32 conditionId, address collateral, address passT, address failT)
        private
        returns (uint256 payout)
    {
        uint256 pb = IERC20(passT).balanceOf(msg.sender);
        uint256 fb = IERC20(failT).balanceOf(msg.sender);
        if (pb == 0 && fb == 0) return 0;
        if (pb > 0) IERC20(passT).safeTransferFrom(msg.sender, address(this), pb);
        if (fb > 0) IERC20(failT).safeTransferFrom(msg.sender, address(this), fb);
        payout = vault.redeem(conditionId, collateral, msg.sender);
    }

    function _approveMax(address asset, address spender, uint256 needed) private {
        if (IERC20(asset).allowance(address(this), spender) < needed) {
            IERC20(asset).forceApprove(spender, type(uint256).max);
        }
    }

    function _permit(address asset, PermitArgs calldata permit) private {
        if (!permit.enabled) return;
        try IERC20Permit(asset)
            .permit(msg.sender, address(this), permit.value, permit.deadline, permit.v, permit.r, permit.s) {}
            catch {}
    }
}

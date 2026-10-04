// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IMonetaAMM} from "./interfaces/IMonetaAMM.sol";
import {CPMath} from "./libraries/CPMath.sol";
import {LaggingOracle} from "./libraries/LaggingOracle.sol";
import {
    FeeTooHigh,
    InvalidParam,
    InvalidPool,
    NoLiquidity,
    NotPoolOwner,
    PoolIsClosed,
    PoolNotFound,
    Slippage,
    TradingClosed,
    TwapNotReady,
    ZeroAddress,
    ZeroAmount
} from "./types/MonetaErrors.sol";
import {BPS} from "./types/MonetaTypes.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title MonetaAMM
/// @notice Singleton constant-product AMM. Each pool has a single owner (a Moneta Treasury) who alone provides
///         liquidity, and a lagging TWAP oracle used for futarchy verdicts. Anyone can swap and crank.
/// @dev Invariants: the AMM only ever pulls tokens from `msg.sender`; token balances >= sum of pool reserves;
///      oracle updates happen before reserves change, at most once per second per pool.
///      There is deliberately no swap pause (ADR 0003): an admin able to freeze markets could swing verdicts.
contract MonetaAMM is IMonetaAMM, Ownable2Step, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;
    using LaggingOracle for LaggingOracle.State;

    uint16 public constant MAX_FEE_BPS = 100;
    uint16 public constant MAX_PROTOCOL_SHARE_BPS = 5000;

    struct Pool {
        address base;
        uint16 feeBps;
        bool closed;
        address quote;
        address owner;
        uint128 reserveBase;
        uint128 reserveQuote;
        LaggingOracle.State oracle;
    }

    uint64 private _poolCount;
    // Written through `Pool storage` pointers in createPool/swap/liquidity paths; mappings need no initialisation.
    // slither-disable-next-line uninitialized-state
    mapping(uint64 poolId => Pool) private _pools;

    /// @inheritdoc IMonetaAMM
    address public feeRecipient;
    /// @inheritdoc IMonetaAMM
    uint16 public protocolFeeShareBps;

    constructor(address initialOwner, address feeRecipient_, uint16 protocolFeeShareBps_)
        Ownable(initialOwner)
    {
        if (protocolFeeShareBps_ > MAX_PROTOCOL_SHARE_BPS) revert FeeTooHigh();
        feeRecipient = feeRecipient_;
        protocolFeeShareBps = protocolFeeShareBps_;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pool lifecycle (owner-only liquidity)
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IMonetaAMM
    function createPool(PoolInit calldata init) external returns (uint64 poolId) {
        if (init.base == address(0) || init.quote == address(0)) revert ZeroAddress();
        if (init.base == init.quote) revert InvalidPool();
        if (init.feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (init.twapEnd <= init.twapStart) revert InvalidParam("twapWindow");

        poolId = ++_poolCount;
        Pool storage p = _pools[poolId];
        p.base = init.base;
        p.quote = init.quote;
        p.owner = msg.sender;
        p.feeBps = init.feeBps;
        p.oracle.init(init.twapStart, init.twapEnd, init.maxStepPerSecond);

        emit PoolCreated(
            poolId,
            init.base,
            init.quote,
            msg.sender,
            init.feeBps,
            init.twapStart,
            init.twapEnd,
            init.maxStepPerSecond
        );
    }

    /// @inheritdoc IMonetaAMM
    /// @dev For a non-empty pool only the ratio-matched amounts are pulled, so liquidity never moves the price.
    function addLiquidity(uint64 poolId, uint256 baseDesired, uint256 quoteDesired)
        external
        nonReentrant
        returns (uint256 baseUsed, uint256 quoteUsed)
    {
        Pool storage p = _ownedOpenPool(poolId);
        if (baseDesired == 0 || quoteDesired == 0) revert ZeroAmount();

        bool empty = p.reserveBase == 0 || p.reserveQuote == 0;
        if (empty) {
            (baseUsed, quoteUsed) = (baseDesired, quoteDesired);
        } else {
            _update(poolId, p);
            (baseUsed, quoteUsed) =
                CPMath.ratioMatched(baseDesired, quoteDesired, p.reserveBase, p.reserveQuote);
            if (baseUsed == 0 || quoteUsed == 0) revert ZeroAmount();
        }

        _pullExact(p.base, baseUsed);
        _pullExact(p.quote, quoteUsed);
        p.reserveBase = (p.reserveBase + baseUsed).toUint128();
        p.reserveQuote = (p.reserveQuote + quoteUsed).toUint128();

        if (empty) {
            p.oracle.seed(CPMath.spotPrice(p.reserveBase, p.reserveQuote));
            emit ObservationUpdated(
                poolId, p.oracle.observation, p.oracle.cumulative, uint40(block.timestamp)
            );
        }
        emit LiquidityAdded(poolId, baseUsed, quoteUsed, p.reserveBase, p.reserveQuote);
    }

    /// @inheritdoc IMonetaAMM
    /// @dev Removing 100% closes the pool permanently.
    function removeLiquidity(uint64 poolId, uint16 shareBps, address to)
        external
        nonReentrant
        returns (uint256 base, uint256 quote_)
    {
        Pool storage p = _ownedOpenPool(poolId);
        if (shareBps == 0 || shareBps > BPS) revert InvalidParam("shareBps");
        if (to == address(0)) revert ZeroAddress();

        if (p.reserveBase > 0 && p.reserveQuote > 0) _update(poolId, p);
        base = uint256(p.reserveBase) * shareBps / BPS;
        quote_ = uint256(p.reserveQuote) * shareBps / BPS;
        p.reserveBase -= base.toUint128();
        p.reserveQuote -= quote_.toUint128();
        if (shareBps == BPS) {
            p.closed = true;
            emit PoolClosed(poolId);
        }

        if (base > 0) IERC20(p.base).safeTransfer(to, base);
        if (quote_ > 0) IERC20(p.quote).safeTransfer(to, quote_);
        emit LiquidityRemoved(poolId, to, base, quote_, p.reserveBase, p.reserveQuote);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Trading
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IMonetaAMM
    function swap(uint64 poolId, bool baseIn, uint256 amountIn, uint256 minOut, address to)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        Pool storage p = _pools[poolId];
        if (p.owner == address(0)) revert PoolNotFound();
        if (p.closed) revert PoolIsClosed();
        if (block.timestamp >= p.oracle.twapEnd) revert TradingClosed();
        if (amountIn == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        if (p.reserveBase == 0 || p.reserveQuote == 0) revert NoLiquidity();

        // Observe the pre-trade price first: a trade's impact only enters the oracle on a later second.
        _update(poolId, p);

        uint256 protocolFee;
        (amountOut, protocolFee) = _executeSwap(p, baseIn, amountIn, minOut, to);
        _emitSwap(poolId, p, to, baseIn, amountIn, amountOut, protocolFee);
    }

    function _executeSwap(Pool storage p, bool baseIn, uint256 amountIn, uint256 minOut, address to)
        private
        returns (uint256 amountOut, uint256 protocolFee)
    {
        uint256 reserveIn = baseIn ? p.reserveBase : p.reserveQuote;
        uint256 reserveOut = baseIn ? p.reserveQuote : p.reserveBase;

        uint256 fee;
        (amountOut, fee) = CPMath.getAmountOut(amountIn, reserveIn, reserveOut, p.feeBps);
        if (amountOut < minOut) revert Slippage(amountOut, minOut);
        if (amountOut == 0) revert ZeroAmount();

        address tokenIn = baseIn ? p.base : p.quote;
        _pullExact(tokenIn, amountIn);

        if (feeRecipient != address(0)) protocolFee = fee * protocolFeeShareBps / BPS;
        _applyReserves(p, baseIn, reserveIn + amountIn - protocolFee, reserveOut - amountOut);

        if (protocolFee > 0) IERC20(tokenIn).safeTransfer(feeRecipient, protocolFee);
        IERC20(baseIn ? p.quote : p.base).safeTransfer(to, amountOut);
    }

    function _applyReserves(Pool storage p, bool baseIn, uint256 newIn, uint256 newOut) private {
        if (baseIn) {
            p.reserveBase = newIn.toUint128();
            p.reserveQuote = newOut.toUint128();
        } else {
            p.reserveQuote = newIn.toUint128();
            p.reserveBase = newOut.toUint128();
        }
    }

    function _emitSwap(
        uint64 poolId,
        Pool storage p,
        address to,
        bool baseIn,
        uint256 amountIn,
        uint256 amountOut,
        uint256 protocolFee
    ) private {
        emit Swap(
            poolId, msg.sender, to, baseIn, amountIn, amountOut, protocolFee, p.reserveBase, p.reserveQuote
        );
    }

    /// @inheritdoc IMonetaAMM
    function crank(uint64 poolId) external {
        Pool storage p = _pools[poolId];
        if (p.owner == address(0)) revert PoolNotFound();
        if (p.reserveBase == 0 || p.reserveQuote == 0) return;
        _update(poolId, p);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin (protocol Safe) — fee parameters only
    // ─────────────────────────────────────────────────────────────────────────

    function setFeeRecipient(address recipient) external onlyOwner {
        feeRecipient = recipient;
        emit FeeRecipientSet(recipient);
    }

    function setProtocolFeeShareBps(uint16 shareBps) external onlyOwner {
        if (shareBps > MAX_PROTOCOL_SHARE_BPS) revert FeeTooHigh();
        protocolFeeShareBps = shareBps;
        emit ProtocolFeeShareSet(shareBps);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IMonetaAMM
    function poolCount() external view returns (uint64) {
        return _poolCount;
    }

    /// @inheritdoc IMonetaAMM
    function getPool(uint64 poolId) external view returns (PoolView memory v) {
        Pool storage p = _existing(poolId);
        v.base = p.base;
        v.quote = p.quote;
        v.owner = p.owner;
        v.feeBps = p.feeBps;
        v.closed = p.closed;
        v.reserveBase = p.reserveBase;
        v.reserveQuote = p.reserveQuote;
        v.observation = p.oracle.observation;
        v.cumulative = p.oracle.cumulative;
        v.maxStepPerSecond = p.oracle.maxStepPerSecond;
        v.lastUpdate = p.oracle.lastUpdate;
        v.twapStart = p.oracle.twapStart;
        v.twapEnd = p.oracle.twapEnd;
    }

    /// @inheritdoc IMonetaAMM
    function quote(uint64 poolId, bool baseIn, uint256 amountIn)
        external
        view
        returns (uint256 amountOut, uint256 fee)
    {
        Pool storage p = _existing(poolId);
        (uint256 reserveIn, uint256 reserveOut) = baseIn
            ? (uint256(p.reserveBase), uint256(p.reserveQuote))
            : (uint256(p.reserveQuote), uint256(p.reserveBase));
        if (reserveIn == 0 || reserveOut == 0) return (0, 0);
        return CPMath.getAmountOut(amountIn, reserveIn, reserveOut, p.feeBps);
    }

    /// @inheritdoc IMonetaAMM
    function spotPrice(uint64 poolId) external view returns (uint256) {
        Pool storage p = _existing(poolId);
        if (p.reserveBase == 0) return 0;
        return CPMath.spotPrice(p.reserveBase, p.reserveQuote);
    }

    /// @inheritdoc IMonetaAMM
    /// @dev Virtual: includes the observation's movement since the last update.
    function observation(uint64 poolId) external view returns (uint256) {
        Pool storage p = _existing(poolId);
        return p.oracle.observationNow(_spot(p));
    }

    /// @inheritdoc IMonetaAMM
    function twap(uint64 poolId) external view returns (uint256) {
        Pool storage p = _existing(poolId);
        if (block.timestamp < p.oracle.twapEnd) revert TwapNotReady();
        return p.oracle.twap(_spot(p));
    }

    /// @inheritdoc IMonetaAMM
    function twapSoFar(uint64 poolId) external view returns (uint256) {
        Pool storage p = _existing(poolId);
        return p.oracle.twapSoFar(_spot(p));
    }

    /// @inheritdoc IMonetaAMM
    function cumulativeNow(uint64 poolId) external view returns (uint256) {
        Pool storage p = _existing(poolId);
        return p.oracle.cumulativeNow(_spot(p));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Spot price; a drained/closed pool keeps its last observation (no movement).
    function _spot(Pool storage p) private view returns (uint256) {
        if (p.reserveBase == 0 || p.reserveQuote == 0) return p.oracle.observation;
        return CPMath.spotPrice(p.reserveBase, p.reserveQuote);
    }

    function _update(uint64 poolId, Pool storage p) private {
        if (p.oracle.update(_spot(p))) {
            emit ObservationUpdated(
                poolId, p.oracle.observation, p.oracle.cumulative, uint40(block.timestamp)
            );
        }
    }

    /// @dev Pull exactly `amount` from msg.sender; reject fee-on-transfer / rebasing behaviour.
    function _pullExact(address token, uint256 amount) private {
        uint256 before = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        if (IERC20(token).balanceOf(address(this)) - before != amount) revert InvalidPool();
    }

    function _existing(uint64 poolId) private view returns (Pool storage p) {
        p = _pools[poolId];
        if (p.owner == address(0)) revert PoolNotFound();
    }

    function _ownedOpenPool(uint64 poolId) private view returns (Pool storage p) {
        p = _existing(poolId);
        if (p.owner != msg.sender) revert NotPoolOwner();
        if (p.closed) revert PoolIsClosed();
    }
}

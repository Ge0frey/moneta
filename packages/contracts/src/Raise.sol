// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IMonetaFactory} from "./interfaces/IMonetaFactory.sol";
import {IRaise} from "./interfaces/IRaise.sol";
import {ITreasury} from "./interfaces/ITreasury.sol";
import {
    AlreadyClaimed,
    AlreadyFinalized,
    GraceNotOver,
    NotFinalized,
    NotOpen,
    NothingToClaim,
    TooEarly,
    TransferAmountMismatch,
    Unauthorized,
    ZeroAmount
} from "./types/MonetaErrors.sol";
import {BPS, RaiseStatus, TOKEN_UNIT} from "./types/MonetaTypes.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title Raise
/// @notice Per-raise USDC escrow. Contributions during a fixed window; one price for everyone; below the minimum
///         everyone is refunded; above the maximum the excess is refunded pro-rata. Finalizing a successful raise
///         launches the project atomically. Distribution is pull-based (`claim`).
/// @dev EIP-1167 clone. Exit guarantee: if a raise is still not finalized `finalizeGrace` after `end`, anyone can
///      `abort()` it and every contributor gets a full refund — funds can never be trapped by a reverting launch.
contract Raise is IRaise, Initializable, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    address public factory;
    uint256 public raiseId;
    address public quote;
    address public founder;
    uint128 public price;
    uint128 public minRaise;
    uint128 public maxRaise;
    uint40 public start;
    uint40 public end;
    uint40 public finalizeGrace;
    uint16 public liquidityBps;
    uint16 public feeBps;
    bytes private _projectConfig;

    RaiseStatus public status;
    uint256 public totalContributed;
    uint256 public contributorCount;
    uint256 public accepted;
    uint256 public contributorTokens;
    address public token;
    address public treasury;

    mapping(address account => uint256) public contributionOf;
    mapping(address account => bool) public claimed;

    constructor() {
        _disableInitializers();
    }

    /// @inheritdoc IRaise
    function initialize(InitArgs calldata a) external initializer {
        if (msg.sender != a.factory) revert Unauthorized();
        factory = a.factory;
        raiseId = a.raiseId;
        quote = a.quote;
        founder = a.founder;
        price = a.price;
        minRaise = a.minRaise;
        maxRaise = a.maxRaise;
        start = a.start;
        end = a.end;
        finalizeGrace = a.finalizeGrace;
        liquidityBps = a.liquidityBps;
        feeBps = a.feeBps;
        _projectConfig = a.projectConfig;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Contribute
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IRaise
    function contribute(uint256 amount) external nonReentrant {
        _contribute(amount);
    }

    /// @inheritdoc IRaise
    function contributeWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
        nonReentrant
    {
        // A front-run (already consumed) permit must not block the contribution if allowance is in place.
        try IERC20Permit(quote).permit(msg.sender, address(this), amount, deadline, v, r, s) {} catch {}
        _contribute(amount);
    }

    function _contribute(uint256 amount) private {
        if (status != RaiseStatus.Open || block.timestamp < start || block.timestamp >= end) {
            revert NotOpen();
        }
        if (amount == 0) revert ZeroAmount();

        uint256 before = IERC20(quote).balanceOf(address(this));
        IERC20(quote).safeTransferFrom(msg.sender, address(this), amount);
        if (IERC20(quote).balanceOf(address(this)) - before != amount) revert TransferAmountMismatch();

        uint256 prior = contributionOf[msg.sender];
        if (prior == 0) ++contributorCount;
        contributionOf[msg.sender] = prior + amount;
        totalContributed += amount;
        emit Contributed(msg.sender, amount, prior + amount, totalContributed);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Finalize
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IRaise
    function finalize() external nonReentrant {
        if (status != RaiseStatus.Open) revert AlreadyFinalized();
        if (block.timestamp < end) revert TooEarly();

        if (totalContributed < minRaise) {
            status = RaiseStatus.Failed;
            emit RaiseFinalized(RaiseStatus.Failed, 0, 0, address(0), address(0));
            return;
        }

        uint256 acc = Math.min(totalContributed, maxRaise);
        accepted = acc;
        contributorTokens = acc * TOKEN_UNIT / price;
        uint256 fee = acc * feeBps / BPS;
        status = RaiseStatus.Succeeded;

        (address token_, address treasury_) = IMonetaFactory(factory).launch(raiseId, _projectConfig);
        token = token_;
        treasury = treasury_;

        address recipient = IMonetaFactory(factory).feeRecipient();
        if (recipient == address(0)) fee = 0;
        uint256 net = acc - fee;
        if (fee > 0) IERC20(quote).safeTransfer(recipient, fee);
        IERC20(quote).safeTransfer(treasury_, net);
        ITreasury(treasury_).launch(contributorTokens, net * liquidityBps / BPS, price);

        emit RaiseFinalized(RaiseStatus.Succeeded, acc, fee, token_, treasury_);
    }

    /// @inheritdoc IRaise
    function abort() external nonReentrant {
        if (status != RaiseStatus.Open) revert AlreadyFinalized();
        if (block.timestamp < uint256(end) + finalizeGrace) revert GraceNotOver();
        status = RaiseStatus.Failed;
        emit RaiseAborted();
        emit RaiseFinalized(RaiseStatus.Failed, 0, 0, address(0), address(0));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Claim
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IRaise
    function claim() external nonReentrant returns (uint256 tokens, uint256 refund) {
        if (status == RaiseStatus.Open) revert NotFinalized();
        uint256 c = contributionOf[msg.sender];
        if (c == 0) revert NothingToClaim();
        if (claimed[msg.sender]) revert AlreadyClaimed();
        claimed[msg.sender] = true;

        (tokens, refund) = _entitlement(c);
        if (tokens > 0) IERC20(token).safeTransfer(msg.sender, tokens);
        if (refund > 0) IERC20(quote).safeTransfer(msg.sender, refund);
        emit Claimed(msg.sender, tokens, refund);
    }

    /// @inheritdoc IRaise
    function previewClaim(address account) external view returns (uint256 tokens, uint256 refund) {
        if (status == RaiseStatus.Open || claimed[account]) return (0, 0);
        uint256 c = contributionOf[account];
        if (c == 0) return (0, 0);
        return _entitlement(c);
    }

    /// @inheritdoc IRaise
    function projectConfig() external view returns (bytes memory) {
        return _projectConfig;
    }

    /// @dev Allocation rounds UP so that Σ refunds never exceed the escrow's leftover (total − accepted);
    ///      tokens round DOWN so that Σ tokens never exceed `contributorTokens`.
    function _entitlement(uint256 c) private view returns (uint256 tokens, uint256 refund) {
        if (status == RaiseStatus.Failed) return (0, c);
        uint256 total = totalContributed;
        uint256 alloc = Math.mulDiv(c, accepted, total, Math.Rounding.Ceil);
        tokens = Math.mulDiv(c, contributorTokens, total);
        refund = c - alloc;
    }
}

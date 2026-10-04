// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IMonetaFactory} from "./interfaces/IMonetaFactory.sol";
import {IRaise} from "./interfaces/IRaise.sol";
import {IProjectToken} from "./interfaces/ITokens.sol";
import {ITreasury} from "./interfaces/ITreasury.sol";
import {Validation} from "./libraries/Validation.sol";
import {
    AlreadyLaunched,
    CreationPaused,
    FeeTooHigh,
    InvalidParam,
    MemoTooLarge,
    QuoteNotAllowed,
    UnknownRaise,
    ZeroAddress
} from "./types/MonetaErrors.sol";
import {BPS, Bounds, PerfTranche, ProjectConfig, RaiseParams, TOKEN_UNIT} from "./types/MonetaTypes.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

/// @title MonetaFactory
/// @notice Permissionless raise creation, project launch (clones), registry and protocol configuration.
/// @dev The owner (protocol Safe) can only: allowlist quote assets, set fees within hard caps, set bounds for NEW
///      raises, set the fee recipient, and pause NEW raise creation. It can never touch escrow or treasury funds,
///      change a live raise/project, or pause exits (ADR 0003).
contract MonetaFactory is IMonetaFactory, Ownable2Step {
    uint16 public constant MAX_RAISE_FEE_BPS = 300;
    uint16 public constant MAX_POOL_FEE_BPS = 100;

    struct ConstructorArgs {
        address owner;
        address vault;
        address amm;
        address raiseImplementation;
        address treasuryImplementation;
        address tokenImplementation;
        address feeRecipient;
        uint16 raiseFeeBps;
        uint16 poolFeeBps;
        Bounds bounds;
    }

    struct Project {
        address token;
        address treasury;
    }

    address public immutable vault;
    address public immutable amm;
    address public immutable raiseImplementation;
    address public immutable treasuryImplementation;
    address public immutable tokenImplementation;

    uint16 public raiseFeeBps;
    uint16 public poolFeeBps;
    address public feeRecipient;
    bool public creationPaused;
    Bounds private _bounds;

    mapping(address quote => bool) public quoteAllowed;
    uint256 public raiseCount;
    mapping(uint256 raiseId => address) public raiseOf;
    mapping(address raise => uint256) public raiseIdOf;
    mapping(uint256 projectId => Project) private _projects;
    mapping(address treasury => uint256) public projectIdOf;

    constructor(ConstructorArgs memory a) Ownable(a.owner) {
        if (
            a.vault == address(0) || a.amm == address(0) || a.raiseImplementation == address(0)
                || a.treasuryImplementation == address(0) || a.tokenImplementation == address(0)
        ) revert ZeroAddress();
        if (a.raiseFeeBps > MAX_RAISE_FEE_BPS || a.poolFeeBps > MAX_POOL_FEE_BPS) revert FeeTooHigh();
        vault = a.vault;
        amm = a.amm;
        raiseImplementation = a.raiseImplementation;
        treasuryImplementation = a.treasuryImplementation;
        tokenImplementation = a.tokenImplementation;
        feeRecipient = a.feeRecipient;
        raiseFeeBps = a.raiseFeeBps;
        poolFeeBps = a.poolFeeBps;
        _setBounds(a.bounds);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Permissionless raise creation
    // ═════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IMonetaFactory
    function createRaise(RaiseParams calldata p, string calldata memo)
        external
        returns (uint256 raiseId, address raise)
    {
        if (creationPaused) revert CreationPaused();
        Bounds memory b = _bounds;
        if (bytes(memo).length > b.maxMemoBytes) revert MemoTooLarge(bytes(memo).length, b.maxMemoBytes);

        uint40 start = p.start < block.timestamp ? uint40(block.timestamp) : p.start;
        _validate(p, start, b);

        raiseId = ++raiseCount;
        raise = Clones.cloneDeterministic(raiseImplementation, bytes32(raiseId));
        IRaise(raise)
            .initialize(
                IRaise.InitArgs({
                    factory: address(this),
                    raiseId: raiseId,
                    quote: p.quote,
                    founder: p.founder,
                    price: p.price,
                    minRaise: p.minRaise,
                    maxRaise: p.maxRaise,
                    start: start,
                    end: p.end,
                    finalizeGrace: b.finalizeGrace,
                    liquidityBps: p.liquidityBps,
                    feeBps: raiseFeeBps,
                    projectConfig: _encodeProjectConfig(p)
                })
            );
        raiseOf[raiseId] = raise;
        raiseIdOf[raise] = raiseId;

        RaiseParams memory normalized = p;
        normalized.start = start;
        emit RaiseCreated(
            raiseId, raise, p.founder, msg.sender, p.quote, normalized, keccak256(bytes(memo)), memo
        );
    }

    /// @inheritdoc IMonetaFactory
    /// @dev Called by a successful Raise inside `finalize`. Deploys the ProjectToken + Treasury clones.
    function launch(uint256 raiseId, bytes calldata projectConfig)
        external
        returns (address token, address treasury)
    {
        if (raiseId == 0 || raiseOf[raiseId] != msg.sender) revert UnknownRaise();
        if (_projects[raiseId].treasury != address(0)) revert AlreadyLaunched();

        ProjectConfig memory c = abi.decode(projectConfig, (ProjectConfig));
        token = Clones.cloneDeterministic(tokenImplementation, bytes32(raiseId));
        treasury = Clones.cloneDeterministic(treasuryImplementation, bytes32(raiseId));
        _projects[raiseId] = Project(token, treasury);
        projectIdOf[treasury] = raiseId;

        IProjectToken(token).initialize(c.name, c.symbol, treasury);
        ITreasury(treasury)
            .initialize(
                ITreasury.InitArgs({
                    projectId: raiseId,
                    factory: address(this),
                    token: token,
                    quote: IRaise(msg.sender).quote(),
                    amm: amm,
                    vault: vault,
                    raise: msg.sender,
                    config: c
                })
            );
        emit ProjectLaunched(raiseId, msg.sender, token, treasury);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Admin (protocol Safe)
    // ═════════════════════════════════════════════════════════════════════════

    function setQuoteAllowed(address quote, bool allowed) external onlyOwner {
        if (quote == address(0)) revert ZeroAddress();
        quoteAllowed[quote] = allowed;
        emit QuoteAllowed(quote, allowed);
    }

    function setFees(uint16 raiseFeeBps_, uint16 poolFeeBps_) external onlyOwner {
        if (raiseFeeBps_ > MAX_RAISE_FEE_BPS || poolFeeBps_ > MAX_POOL_FEE_BPS) revert FeeTooHigh();
        raiseFeeBps = raiseFeeBps_;
        poolFeeBps = poolFeeBps_;
        emit FeesUpdated(raiseFeeBps_, poolFeeBps_);
    }

    function setFeeRecipient(address recipient) external onlyOwner {
        feeRecipient = recipient;
        emit FeeRecipientSet(recipient);
    }

    function setBounds(Bounds calldata b) external onlyOwner {
        _setBounds(b);
    }

    function setCreationPaused(bool paused) external onlyOwner {
        creationPaused = paused;
        emit CreationPausedSet(paused);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Views
    // ═════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IMonetaFactory
    function bounds() external view returns (Bounds memory) {
        return _bounds;
    }

    /// @inheritdoc IMonetaFactory
    function isRaise(address raise) external view returns (bool) {
        return raiseIdOf[raise] != 0;
    }

    /// @inheritdoc IMonetaFactory
    function isTreasury(address treasury) external view returns (bool) {
        return projectIdOf[treasury] != 0;
    }

    /// @inheritdoc IMonetaFactory
    function projectOf(uint256 projectId) external view returns (address token, address treasury) {
        Project memory p = _projects[projectId];
        return (p.token, p.treasury);
    }

    /// @inheritdoc IMonetaFactory
    function predictProject(uint256 raiseId) external view returns (address token, address treasury) {
        token = Clones.predictDeterministicAddress(tokenImplementation, bytes32(raiseId));
        treasury = Clones.predictDeterministicAddress(treasuryImplementation, bytes32(raiseId));
    }

    /// @inheritdoc IMonetaFactory
    function predictRaise(uint256 raiseId) external view returns (address) {
        return Clones.predictDeterministicAddress(raiseImplementation, bytes32(raiseId));
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Internals
    // ═════════════════════════════════════════════════════════════════════════

    function _validate(RaiseParams calldata p, uint40 start, Bounds memory b) private view {
        if (!quoteAllowed[p.quote]) revert QuoteNotAllowed(p.quote);
        if (p.founder == address(0)) revert ZeroAddress();
        if (bytes(p.name).length == 0 || bytes(p.name).length > 32) revert InvalidParam("name");
        if (bytes(p.symbol).length == 0 || bytes(p.symbol).length > 11) revert InvalidParam("symbol");
        if (p.price == 0 || uint256(p.minRaise) * TOKEN_UNIT / p.price == 0) revert InvalidParam("price");
        if (p.minRaise == 0 || p.maxRaise < p.minRaise) revert InvalidParam("raiseRange");
        if (start - block.timestamp > b.maxStartDelay) revert InvalidParam("start");
        if (p.end <= start || p.end - start < b.minRaiseWindow || p.end - start > b.maxRaiseWindow) {
            revert InvalidParam("window");
        }
        if (p.liquidityBps < b.minLiquidityBps || p.liquidityBps > b.maxLiquidityBps) {
            revert InvalidParam("liquidity");
        }
        _validateTranches(p.trancheBps, b);
        _validatePerf(p.perf, p.perfUnlockWindow, b);
        Validation.validateGov(p.gov, b);
    }

    function _validateTranches(uint16[] calldata t, Bounds memory b) private pure {
        if (t.length > b.maxTranches) revert InvalidParam("tranches");
        uint256 sum;
        for (uint256 i; i < t.length; ++i) {
            if (t[i] == 0) revert InvalidParam("tranches");
            sum += t[i];
        }
        if (sum > BPS) revert InvalidParam("tranches");
    }

    function _validatePerf(PerfTranche[] calldata perf, uint40 unlockWindow, Bounds memory b) private pure {
        if (perf.length > b.maxPerfTranches) revert InvalidParam("perf");
        if (perf.length > 0 && unlockWindow == 0) revert InvalidParam("perf");
        uint16 prev = 99;
        for (uint256 i; i < perf.length; ++i) {
            if (perf[i].multipleX100 <= prev || perf[i].amount == 0) revert InvalidParam("perf");
            prev = perf[i].multipleX100;
        }
    }

    function _encodeProjectConfig(RaiseParams calldata p) private pure returns (bytes memory) {
        return abi.encode(
            ProjectConfig({
                name: p.name,
                symbol: p.symbol,
                founder: p.founder,
                budgetPerMonth: p.budgetPerMonth,
                trancheBps: p.trancheBps,
                perf: p.perf,
                perfCliff: p.perfCliff,
                perfUnlockWindow: p.perfUnlockWindow,
                gov: p.gov
            })
        );
    }

    function _setBounds(Bounds memory b) private {
        if (
            b.minRaiseWindow == 0 || b.minRaiseWindow > b.maxRaiseWindow || b.minLiquidityBps == 0
                || b.minLiquidityBps > b.maxLiquidityBps || b.maxLiquidityBps > BPS
                || b.minWarmup > b.maxWarmup || b.minDuration == 0 || b.minDuration > b.maxDuration
                || b.minProposalLiquidityBps == 0 || b.minProposalLiquidityBps > b.maxProposalLiquidityBps
                || b.maxProposalLiquidityBps >= BPS || b.minMaxStepBps == 0
                || b.minMaxStepBps > b.maxMaxStepBps || b.minTheta > b.maxTheta
                || b.minTheta <= -int16(int256(BPS)) || b.minExecutionGrace == 0 || b.maxMintBps > BPS
        ) revert InvalidParam("bounds");
        _bounds = b;
        emit BoundsUpdated(b);
    }
}

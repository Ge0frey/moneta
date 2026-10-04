// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IConditionalVault} from "./interfaces/IConditionalVault.sol";
import {IMonetaAMM} from "./interfaces/IMonetaAMM.sol";
import {IMonetaFactory} from "./interfaces/IMonetaFactory.sol";
import {IProjectToken} from "./interfaces/ITokens.sol";
import {ITreasury} from "./interfaces/ITreasury.sol";
import {CPMath} from "./libraries/CPMath.sol";
import {Validation} from "./libraries/Validation.sol";
import {
    AlreadyLaunched,
    AlreadyUnlocked,
    BondsAtRisk,
    ExecutionExpired,
    InsufficientFunds,
    InvalidAction,
    InvalidParam,
    MemoTooLarge,
    NotActive,
    NotFounder,
    NotLaunched,
    NotPassed,
    NotRedeemed,
    ProjectRedeemed,
    RedemptionQueued,
    SlotBusy,
    TargetNotMet,
    TooEarly,
    TransferAmountMismatch,
    Unauthorized,
    UnlockNotStarted,
    ZeroAmount
} from "./types/MonetaErrors.sol";
import {
    ActionType,
    BPS,
    Bounds,
    GovConfig,
    MONTH,
    Outcome,
    PRICE_SCALE,
    PerfState,
    PermitArgs,
    ProjectState,
    Proposal,
    ProposalStatus,
    TOKEN_UNIT,
    Tranche
} from "./types/MonetaTypes.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title Treasury
/// @notice A Moneta project's market-governed treasury and futarchy engine (ADR 0002). Funds leave only through:
///         the founder's streamed budget, PASSED proposals, bond refunds, or holder redemption after wind-down.
/// @dev Deployed as an EIP-1167 clone per project. Privileged actions run only via `executeAction` (onlySelf),
///      reachable solely from a PASSED proposal. One active proposal at a time + one queued Redemption (ADR 0004).
contract Treasury is ITreasury, Initializable, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;
    using Strings for uint256;

    // InvalidAction codes (decoded by the SDK into human messages)
    uint8 internal constant ACT_TRANCHE_NOT_FOUNDER = 1;
    uint8 internal constant ACT_TRANCHE_INDEX = 2;
    uint8 internal constant ACT_TRANCHE_RELEASED = 3;
    uint8 internal constant ACT_ZERO_ADDRESS = 4;
    uint8 internal constant ACT_ZERO_AMOUNT = 5;
    uint8 internal constant ACT_MINT_CAP = 6;
    uint8 internal constant ACT_FORBIDDEN_TARGET = 7;

    /// @dev Working set for activating a proposal's markets (kept in memory to stay clear of stack limits).
    struct Markets {
        bytes32 conditionId;
        address passToken;
        address failToken;
        address passQuote;
        address failQuote;
        uint256 base;
        uint256 quote;
        uint128 step;
        uint40 start;
        uint40 end;
        uint64 passPool;
        uint64 failPool;
    }

    // ── wiring ───────────────────────────────────────────────────────────────
    uint256 public projectId;
    address public factory;
    address public token;
    address public quote;
    address public amm;
    address public vault;
    address public raise;

    // ── launch ───────────────────────────────────────────────────────────────
    uint64 public spotPoolId;
    uint128 public raisePrice;
    uint40 public launchedAt;

    // ── founder & budget ─────────────────────────────────────────────────────
    address public founder;
    uint128 public budgetPerMonth;
    uint40 public budgetLastClaim;

    // ── governance ───────────────────────────────────────────────────────────
    GovConfig private _config;
    Tranche[] private _tranches;
    PerfState[] private _perf;
    uint40 private _perfCliff;
    uint40 public perfCliffEnd;
    uint40 public perfUnlockWindow;

    // ── proposals ────────────────────────────────────────────────────────────
    mapping(uint256 id => Proposal) private _proposals;
    uint256 public proposalCount;
    uint256 public activeProposalId;
    uint256 public queuedRedemptionId;
    uint256 public bondsHeld;

    // ── wind-down ────────────────────────────────────────────────────────────
    ProjectState public state;
    uint256 public redemptionQuote;
    uint256 public redemptionSupply;

    modifier onlyFounder() {
        if (msg.sender != founder) revert NotFounder();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Lifecycle
    // ═════════════════════════════════════════════════════════════════════════

    /// @inheritdoc ITreasury
    function initialize(InitArgs calldata a) external initializer {
        if (msg.sender != a.factory) revert Unauthorized();
        projectId = a.projectId;
        factory = a.factory;
        token = a.token;
        quote = a.quote;
        amm = a.amm;
        vault = a.vault;
        raise = a.raise;
        founder = a.config.founder;
        budgetPerMonth = a.config.budgetPerMonth;
        _config = a.config.gov;
        _perfCliff = a.config.perfCliff;
        perfUnlockWindow = a.config.perfUnlockWindow;
        for (uint256 i; i < a.config.trancheBps.length; ++i) {
            _tranches.push(Tranche({bps: a.config.trancheBps[i], amount: 0, released: false}));
        }
        for (uint256 i; i < a.config.perf.length; ++i) {
            _perf.push(
                PerfState({
                    multipleX100: a.config.perf[i].multipleX100,
                    amount: a.config.perf[i].amount,
                    unlockStart: 0,
                    done: false,
                    cumulativeStart: 0
                })
            );
        }
    }

    /// @inheritdoc ITreasury
    /// @dev Called once by this project's Raise after it transferred the net raise here.
    function launch(uint256 contributorTokens, uint256 liquidityQuote, uint128 price) external nonReentrant {
        if (msg.sender != raise) revert Unauthorized();
        if (launchedAt != 0) revert AlreadyLaunched();

        uint40 nowTs = uint40(block.timestamp);
        raisePrice = price;
        launchedAt = nowTs;
        budgetLastClaim = nowTs;
        perfCliffEnd = nowTs + _perfCliff;

        IProjectToken(token).mint(raise, contributorTokens);
        uint256 liquidityTokens = liquidityQuote * TOKEN_UNIT / price;
        IProjectToken(token).mint(address(this), liquidityTokens);

        uint256 spot = CPMath.spotPrice(liquidityTokens, liquidityQuote);
        spotPoolId = IMonetaAMM(amm)
            .createPool(
                IMonetaAMM.PoolInit({
                    base: token,
                    quote: quote,
                    feeBps: IMonetaFactory(factory).poolFeeBps(),
                    twapStart: nowTs,
                    twapEnd: type(uint40).max,
                    maxStepPerSecond: (spot * _config.maxStepBps / BPS).toUint128()
                })
            );
        IERC20(token).forceApprove(amm, liquidityTokens);
        IERC20(quote).forceApprove(amm, liquidityQuote);
        IMonetaAMM(amm).addLiquidity(spotPoolId, liquidityTokens, liquidityQuote);

        uint256 treasuryQuote = IERC20(quote).balanceOf(address(this));
        for (uint256 i; i < _tranches.length; ++i) {
            _tranches[i].amount = (treasuryQuote * _tranches[i].bps / BPS).toUint128();
        }
        emit Launched(
            projectId, spotPoolId, contributorTokens, liquidityTokens, liquidityQuote, treasuryQuote
        );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Proposals
    // ═════════════════════════════════════════════════════════════════════════

    /// @inheritdoc ITreasury
    function propose(ActionType t, bytes calldata data, string calldata memo, PermitArgs calldata bondPermit)
        external
        nonReentrant
        returns (uint256 id)
    {
        _requireLaunchedActive();
        Bounds memory b = IMonetaFactory(factory).bounds();
        if (bytes(memo).length > b.maxMemoBytes) revert MemoTooLarge(bytes(memo).length, b.maxMemoBytes);

        bool isTeam = msg.sender == founder;
        _validateAction(t, data, isTeam, b);

        bool queued;
        if (activeProposalId != 0) {
            if (queuedRedemptionId != 0) revert RedemptionQueued();
            if (t != ActionType.Redeem || _proposals[activeProposalId].actionType == ActionType.Redeem) {
                revert SlotBusy();
            }
            queued = true;
        }

        uint128 bond = _config.bond;
        if (bond > 0) {
            _permit(quote, bondPermit);
            _pullExact(quote, bond);
            bondsHeld += bond;
        }

        id = ++proposalCount;
        Proposal storage p = _proposals[id];
        p.proposer = msg.sender;
        p.actionType = t;
        p.isTeam = isTeam;
        p.thetaBps = t == ActionType.TrancheRelease
            ? _config.thetaTrancheBps
            : (isTeam ? _config.thetaTeamBps : _config.thetaCommunityBps);
        p.createdAt = uint40(block.timestamp);
        p.bond = bond;
        p.memoHash = keccak256(bytes(memo));
        p.actionData = data;

        emit ProposalCreated(id, msg.sender, t, data, p.memoHash, memo, p.thetaBps, bond, isTeam, queued);

        if (queued) {
            p.status = ProposalStatus.Queued;
            queuedRedemptionId = id;
        } else {
            _activate(id);
        }
    }

    /// @inheritdoc ITreasury
    function finalizeProposal(uint256 id) external nonReentrant {
        Proposal storage p = _proposals[id];
        if (p.status != ProposalStatus.Active) revert NotActive();
        if (block.timestamp < p.tradingEnd) revert TooEarly();

        IMonetaAMM(amm).crank(p.passPoolId);
        IMonetaAMM(amm).crank(p.failPoolId);
        uint256 tP = IMonetaAMM(amm).twap(p.passPoolId);
        uint256 tF = IMonetaAMM(amm).twap(p.failPoolId);
        bool passed = _passes(tP, tF, p.thetaBps);
        p.twapPass = tP;
        p.twapFail = tF;

        IConditionalVault(vault).resolve(p.conditionId, passed ? Outcome.Pass : Outcome.Fail);
        _unwindMarkets(id, p);

        p.status = passed ? ProposalStatus.Passed : ProposalStatus.Failed;
        activeProposalId = 0;
        _settleBond(id, p, passed);
        emit ProposalFinalized(id, passed, tP, tF);

        if (passed) {
            try this.executeAction(id) {}
            catch (bytes memory reason) {
                emit ProposalExecutionFailed(id, reason);
            }
        }

        uint256 queuedId = queuedRedemptionId;
        if (queuedId != 0) {
            queuedRedemptionId = 0;
            if (state == ProjectState.Active) {
                _activate(queuedId);
            } else {
                _cancel(queuedId);
            }
        }
    }

    /// @inheritdoc ITreasury
    /// @dev Retry path for a PASSED proposal whose automatic execution failed. Reverts with the action's reason.
    function executeProposal(uint256 id) external nonReentrant {
        Proposal storage p = _proposals[id];
        if (p.status != ProposalStatus.Passed) revert NotPassed();
        if (block.timestamp > uint256(p.tradingEnd) + _config.executionGrace) revert ExecutionExpired();
        this.executeAction(id);
    }

    /// @inheritdoc ITreasury
    /// @dev Only callable by this contract (from finalize/execute), so it runs under their reentrancy lock.
    function executeAction(uint256 id) external {
        if (msg.sender != address(this)) revert Unauthorized();
        Proposal storage p = _proposals[id];
        if (p.status != ProposalStatus.Passed) revert NotPassed();

        ActionType t = p.actionType;
        bytes memory data = p.actionData;
        if (t == ActionType.TrancheRelease) _execTranche(abi.decode(data, (uint8)));
        else if (t == ActionType.Transfer) _execTransfer(data);
        else if (t == ActionType.SetBudget) _execSetBudget(abi.decode(data, (uint128)));
        else if (t == ActionType.Mint) _execMint(data);
        else if (t == ActionType.Buyback) _execBuyback(data);
        else if (t == ActionType.UpdateConfig) _execUpdateConfig(abi.decode(data, (GovConfig)));
        else if (t == ActionType.SetFounder) _execSetFounder(abi.decode(data, (address)));
        else if (t == ActionType.Call) _execCall(data);
        else _startRedemption();

        p.status = ProposalStatus.Executed;
        emit ProposalExecuted(id);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Founder
    // ═════════════════════════════════════════════════════════════════════════

    /// @inheritdoc ITreasury
    function claimBudget() external nonReentrant onlyFounder returns (uint256 paid) {
        _requireLaunchedActive();
        paid = _settleBudget();
    }

    /// @inheritdoc ITreasury
    function startPerformanceUnlock(uint8 index) external nonReentrant onlyFounder {
        _requireLaunchedActive();
        if (block.timestamp < perfCliffEnd) revert TooEarly();
        PerfState storage s = _perfAt(index);
        if (s.done) revert AlreadyUnlocked();

        IMonetaAMM(amm).crank(spotPoolId);
        uint256 target = _perfTarget(s.multipleX100);
        uint256 obs = IMonetaAMM(amm).observation(spotPoolId);
        if (obs < target) revert TargetNotMet(obs, target);

        s.unlockStart = uint40(block.timestamp);
        s.cumulativeStart = IMonetaAMM(amm).cumulativeNow(spotPoolId);
        emit PerformanceUnlockStarted(index, s.cumulativeStart, s.unlockStart);
    }

    /// @inheritdoc ITreasury
    function completePerformanceUnlock(uint8 index) external nonReentrant onlyFounder {
        _requireLaunchedActive();
        PerfState storage s = _perfAt(index);
        if (s.done) revert AlreadyUnlocked();
        if (s.unlockStart == 0) revert UnlockNotStarted();
        if (block.timestamp < uint256(s.unlockStart) + perfUnlockWindow) revert TooEarly();

        uint256 elapsed = block.timestamp - s.unlockStart;
        uint256 twap = (IMonetaAMM(amm).cumulativeNow(spotPoolId) - s.cumulativeStart) / elapsed;
        uint256 target = _perfTarget(s.multipleX100);
        if (twap < target) revert TargetNotMet(twap, target);

        s.done = true;
        IProjectToken(token).mint(founder, s.amount);
        emit PerformanceUnlocked(index, s.amount);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Holders
    // ═════════════════════════════════════════════════════════════════════════

    /// @inheritdoc ITreasury
    function redeem(uint256 tokenAmount) external nonReentrant returns (uint256 quoteOut) {
        if (state != ProjectState.Redeemed) revert NotRedeemed();
        if (tokenAmount == 0) revert ZeroAmount();
        quoteOut = tokenAmount * redemptionQuote / redemptionSupply;
        IProjectToken(token).treasuryBurn(msg.sender, tokenAmount);
        if (quoteOut > 0) IERC20(quote).safeTransfer(msg.sender, quoteOut);
        emit RedemptionClaimed(msg.sender, tokenAmount, quoteOut);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Views
    // ═════════════════════════════════════════════════════════════════════════

    /// @inheritdoc ITreasury
    function proposal(uint256 id) external view returns (Proposal memory) {
        return _proposals[id];
    }

    /// @inheritdoc ITreasury
    function config() external view returns (GovConfig memory) {
        return _config;
    }

    /// @inheritdoc ITreasury
    function tranches() external view returns (Tranche[] memory) {
        return _tranches;
    }

    /// @inheritdoc ITreasury
    function perfTranches() external view returns (PerfState[] memory) {
        return _perf;
    }

    /// @inheritdoc ITreasury
    function availableQuote() public view returns (uint256) {
        uint256 bal = IERC20(quote).balanceOf(address(this));
        return bal > bondsHeld ? bal - bondsHeld : 0;
    }

    /// @inheritdoc ITreasury
    function budgetAccrued() public view returns (uint256) {
        if (launchedAt == 0 || state != ProjectState.Active) return 0;
        return uint256(budgetPerMonth) * (block.timestamp - budgetLastClaim) / MONTH;
    }

    /// @inheritdoc ITreasury
    function projectedVerdict(uint256 id)
        external
        view
        returns (bool passing, uint256 twapPass, uint256 twapFail)
    {
        Proposal storage p = _proposals[id];
        if (p.status == ProposalStatus.Active) {
            twapPass = IMonetaAMM(amm).twapSoFar(p.passPoolId);
            twapFail = IMonetaAMM(amm).twapSoFar(p.failPoolId);
        } else {
            (twapPass, twapFail) = (p.twapPass, p.twapFail);
        }
        passing = twapFail > 0 && _passes(twapPass, twapFail, p.thetaBps);
    }

    /// @inheritdoc ITreasury
    /// @notice Treasury value per circulating token (quote raw per 1e18 tokens, same unit as `raisePrice`) —
    ///         what a Redemption would roughly pay out.
    function nav() external view returns (uint256 quoteAssets, uint256 circulating, uint256 navPerToken) {
        uint256 supply = IERC20(token).totalSupply();
        if (state == ProjectState.Redeemed) {
            quoteAssets = availableQuote();
            circulating = supply;
        } else {
            uint256 ownedTokens = IERC20(token).balanceOf(address(this));
            quoteAssets = availableQuote();
            if (launchedAt != 0) {
                IMonetaAMM.PoolView memory spot = IMonetaAMM(amm).getPool(spotPoolId);
                quoteAssets += spot.reserveQuote;
                ownedTokens += spot.reserveBase;
            }
            if (activeProposalId != 0) {
                Proposal storage p = _proposals[activeProposalId];
                quoteAssets += p.migratedQuote;
                ownedTokens += p.migratedBase;
            }
            circulating = supply > ownedTokens ? supply - ownedTokens : 0;
        }
        navPerToken = circulating > 0 ? quoteAssets * TOKEN_UNIT / circulating : 0;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Internals: markets
    // ═════════════════════════════════════════════════════════════════════════

    /// @dev Opens a proposal's decision markets: condition + 4 conditional tokens, migrates POL into PASS/FAIL pools.
    function _activate(uint256 id) private {
        Proposal storage p = _proposals[id];
        Markets memory m;

        m.conditionId = IConditionalVault(vault).prepareCondition(bytes32(id));
        string memory label = string.concat(IERC20Metadata(token).symbol(), "-", id.toString());
        (m.passToken, m.failToken) = IConditionalVault(vault).prepareCollateral(m.conditionId, token, label);
        (m.passQuote, m.failQuote) = IConditionalVault(vault)
            .prepareCollateral(
                m.conditionId, quote, string.concat(IERC20Metadata(quote).symbol(), "-", label)
            );

        (m.base, m.quote) =
            IMonetaAMM(amm).removeLiquidity(spotPoolId, _config.proposalLiquidityBps, address(this));
        if (m.base == 0 || m.quote == 0) revert ZeroAmount();
        IERC20(token).forceApprove(vault, m.base);
        IConditionalVault(vault).split(m.conditionId, token, m.base, address(this));
        IERC20(quote).forceApprove(vault, m.quote);
        IConditionalVault(vault).split(m.conditionId, quote, m.quote, address(this));

        m.step = (CPMath.spotPrice(m.base, m.quote) * _config.maxStepBps / BPS).toUint128();
        m.start = uint40(block.timestamp) + _config.warmup;
        m.end = m.start + _config.duration;
        m.passPool = _openPool(m.passToken, m.passQuote, m);
        m.failPool = _openPool(m.failToken, m.failQuote, m);

        p.status = ProposalStatus.Active;
        p.conditionId = m.conditionId;
        p.passPoolId = m.passPool;
        p.failPoolId = m.failPool;
        p.tradingStart = m.start;
        p.tradingEnd = m.end;
        p.migratedBase = m.base.toUint128();
        p.migratedQuote = m.quote.toUint128();
        activeProposalId = id;

        emit ProposalActivated(
            id,
            m.conditionId,
            m.passPool,
            m.failPool,
            m.start,
            m.end,
            m.passToken,
            m.failToken,
            m.passQuote,
            m.failQuote
        );
        emit LiquidityMigrated(id, m.base, m.quote);
    }

    function _openPool(address baseToken, address quoteToken, Markets memory m)
        private
        returns (uint64 poolId)
    {
        poolId = IMonetaAMM(amm)
            .createPool(
                IMonetaAMM.PoolInit({
                    base: baseToken,
                    quote: quoteToken,
                    feeBps: IMonetaFactory(factory).poolFeeBps(),
                    twapStart: m.start,
                    twapEnd: m.end,
                    maxStepPerSecond: m.step
                })
            );
        // Conditional tokens grant the AMM an implicit allowance — no approval needed.
        IMonetaAMM(amm).addLiquidity(poolId, m.base, m.quote);
    }

    /// @dev Pulls all liquidity from both conditional pools, redeems the winning side and restores spot liquidity.
    function _unwindMarkets(uint256 id, Proposal storage p) private {
        IMonetaAMM(amm).removeLiquidity(p.passPoolId, uint16(BPS), address(this));
        IMonetaAMM(amm).removeLiquidity(p.failPoolId, uint16(BPS), address(this));
        uint256 baseOut = IConditionalVault(vault).redeem(p.conditionId, token, address(this));
        uint256 quoteOut = IConditionalVault(vault).redeem(p.conditionId, quote, address(this));

        uint256 baseUsed;
        uint256 quoteUsed;
        if (baseOut > 0 && quoteOut > 0) {
            IERC20(token).forceApprove(amm, baseOut);
            IERC20(quote).forceApprove(amm, quoteOut);
            try IMonetaAMM(amm).addLiquidity(spotPoolId, baseOut, quoteOut) returns (uint256 b, uint256 q) {
                (baseUsed, quoteUsed) = (b, q);
            } catch {}
            IERC20(token).forceApprove(amm, 0);
            IERC20(quote).forceApprove(amm, 0);
        }
        emit LiquidityRestored(id, baseUsed, quoteUsed, baseOut - baseUsed, quoteOut - quoteUsed);
    }

    function _settleBond(uint256 id, Proposal storage p, bool refund) private {
        uint128 bond = p.bond;
        if (bond == 0) return;
        bondsHeld -= bond;
        if (refund) IERC20(quote).safeTransfer(p.proposer, bond);
        emit BondSettled(id, p.proposer, bond, refund);
    }

    function _cancel(uint256 id) private {
        Proposal storage p = _proposals[id];
        p.status = ProposalStatus.Cancelled;
        _settleBond(id, p, true);
        emit ProposalCancelled(id);
    }

    function _passes(uint256 twapPass, uint256 twapFail, int16 thetaBps) private pure returns (bool) {
        return int256(twapPass) * int256(BPS) >= int256(twapFail) * (int256(BPS) + int256(thetaBps));
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Internals: actions
    // ═════════════════════════════════════════════════════════════════════════

    function _validateAction(ActionType t, bytes calldata data, bool isTeam, Bounds memory b) private view {
        if (t == ActionType.TrancheRelease) {
            if (!isTeam) revert InvalidAction(ACT_TRANCHE_NOT_FOUNDER);
            uint8 idx = abi.decode(data, (uint8));
            if (idx >= _tranches.length) revert InvalidAction(ACT_TRANCHE_INDEX);
            if (_tranches[idx].released) revert InvalidAction(ACT_TRANCHE_RELEASED);
        } else if (t == ActionType.Transfer) {
            (, address to, uint256 amount) = abi.decode(data, (address, address, uint256));
            if (to == address(0)) revert InvalidAction(ACT_ZERO_ADDRESS);
            if (amount == 0) revert InvalidAction(ACT_ZERO_AMOUNT);
        } else if (t == ActionType.SetBudget) {
            abi.decode(data, (uint128));
        } else if (t == ActionType.Mint) {
            (address to, uint256 amount) = abi.decode(data, (address, uint256));
            if (to == address(0)) revert InvalidAction(ACT_ZERO_ADDRESS);
            if (amount == 0) revert InvalidAction(ACT_ZERO_AMOUNT);
            if (amount > IERC20(token).totalSupply() * b.maxMintBps / BPS) {
                revert InvalidAction(ACT_MINT_CAP);
            }
        } else if (t == ActionType.Buyback) {
            (uint256 quoteIn,) = abi.decode(data, (uint256, uint256));
            if (quoteIn == 0) revert InvalidAction(ACT_ZERO_AMOUNT);
        } else if (t == ActionType.UpdateConfig) {
            Validation.validateGov(abi.decode(data, (GovConfig)), b);
        } else if (t == ActionType.SetFounder) {
            if (abi.decode(data, (address)) == address(0)) revert InvalidAction(ACT_ZERO_ADDRESS);
        } else if (t == ActionType.Call) {
            (address target,) = abi.decode(data, (address, bytes));
            if (_forbiddenTarget(target)) revert InvalidAction(ACT_FORBIDDEN_TARGET);
        }
        // Redeem: no payload.
    }

    function _execTranche(uint8 idx) private {
        Tranche storage t = _tranches[idx];
        if (t.released) revert InvalidAction(ACT_TRANCHE_RELEASED);
        uint256 avail = availableQuote();
        if (t.amount > avail) revert InsufficientFunds(t.amount, avail);
        t.released = true;
        IERC20(quote).safeTransfer(founder, t.amount);
        emit TrancheReleased(idx, t.amount, founder);
    }

    function _execTransfer(bytes memory data) private {
        (address asset, address to, uint256 amount) = abi.decode(data, (address, address, uint256));
        if (asset == quote) {
            uint256 avail = availableQuote();
            if (amount > avail) revert InsufficientFunds(amount, avail);
        }
        IERC20(asset).safeTransfer(to, amount);
        emit TransferExecuted(asset, to, amount);
    }

    function _execSetBudget(uint128 perMonth) private {
        _settleBudget();
        budgetPerMonth = perMonth;
        emit BudgetRateSet(perMonth);
    }

    function _execMint(bytes memory data) private {
        (address to, uint256 amount) = abi.decode(data, (address, uint256));
        IProjectToken(token).mint(to, amount);
        emit Minted(to, amount);
    }

    function _execBuyback(bytes memory data) private {
        (uint256 quoteIn, uint256 minOut) = abi.decode(data, (uint256, uint256));
        uint256 avail = availableQuote();
        if (quoteIn > avail) revert InsufficientFunds(quoteIn, avail);
        IERC20(quote).forceApprove(amm, quoteIn);
        uint256 out = IMonetaAMM(amm).swap(spotPoolId, false, quoteIn, minOut, address(this));
        IProjectToken(token).treasuryBurn(address(this), out);
        emit BuybackExecuted(quoteIn, out);
    }

    function _execUpdateConfig(GovConfig memory c) private {
        Validation.validateGov(c, IMonetaFactory(factory).bounds());
        _config = c;
        emit ConfigUpdated(c);
    }

    function _execSetFounder(address newFounder) private {
        _settleBudget();
        founder = newFounder;
        emit FounderSet(newFounder);
    }

    function _execCall(bytes memory data) private {
        (address target, bytes memory callData) = abi.decode(data, (address, bytes));
        (bool ok, bytes memory result) = target.call(callData);
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(result, 0x20), mload(result))
            }
        }
        if (IERC20(quote).balanceOf(address(this)) < bondsHeld) revert BondsAtRisk();
        emit CallExecuted(target, callData, result);
    }

    /// @dev Wind-down: stop the budget, pull all spot liquidity, burn treasury-held tokens, snapshot NAV.
    function _startRedemption() private {
        _settleBudget();
        budgetPerMonth = 0;
        IMonetaAMM(amm).removeLiquidity(spotPoolId, uint16(BPS), address(this));
        uint256 held = IERC20(token).balanceOf(address(this));
        if (held > 0) IProjectToken(token).treasuryBurn(address(this), held);

        state = ProjectState.Redeemed;
        redemptionQuote = availableQuote();
        redemptionSupply = IERC20(token).totalSupply();
        emit RedemptionStarted(redemptionQuote, redemptionSupply);
    }

    function _settleBudget() private returns (uint256 paid) {
        uint256 accrued = budgetAccrued();
        budgetLastClaim = uint40(block.timestamp);
        if (accrued == 0) return 0;
        paid = Math.min(accrued, availableQuote());
        if (paid > 0) {
            IERC20(quote).safeTransfer(founder, paid);
            emit BudgetClaimed(founder, paid);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Internals: misc
    // ═════════════════════════════════════════════════════════════════════════

    function _forbiddenTarget(address target) private view returns (bool) {
        return target == address(this) || target == vault || target == amm || target == token
            || target == factory || target == address(0);
    }

    function _perfAt(uint8 index) private view returns (PerfState storage) {
        if (index >= _perf.length) revert InvalidParam("index");
        return _perf[index];
    }

    /// @dev Performance target in PRICE_SCALE units: raisePrice × multiple.
    function _perfTarget(uint16 multipleX100) private view returns (uint256) {
        return Math.mulDiv(uint256(raisePrice) * multipleX100, PRICE_SCALE, TOKEN_UNIT * 100);
    }

    function _requireLaunchedActive() private view {
        if (launchedAt == 0) revert NotLaunched();
        if (state != ProjectState.Active) revert ProjectRedeemed();
    }

    function _permit(address asset, PermitArgs calldata permit) private {
        if (!permit.enabled) return;
        // A front-run permit (already consumed) must not block the call if allowance is in place.
        try IERC20Permit(asset)
            .permit(msg.sender, address(this), permit.value, permit.deadline, permit.v, permit.r, permit.s) {}
            catch {}
    }

    function _pullExact(address asset, uint256 amount) private {
        uint256 before = IERC20(asset).balanceOf(address(this));
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        if (IERC20(asset).balanceOf(address(this)) - before != amount) revert TransferAmountMismatch();
    }
}

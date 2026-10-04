// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {
    ActionType,
    GovConfig,
    PerfState,
    PermitArgs,
    ProjectConfig,
    ProjectState,
    Proposal,
    Tranche
} from "../types/MonetaTypes.sol";

/// @title ITreasury
/// @notice Per-project market-governed treasury and futarchy engine.
interface ITreasury {
    struct InitArgs {
        uint256 projectId;
        address factory;
        address token;
        address quote;
        address amm;
        address vault;
        address raise;
        ProjectConfig config;
    }

    event Launched(
        uint256 indexed projectId,
        uint64 spotPoolId,
        uint256 contributorTokens,
        uint256 liquidityTokens,
        uint256 liquidityQuote,
        uint256 treasuryQuote
    );
    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        ActionType actionType,
        bytes actionData,
        bytes32 memoHash,
        string memo,
        int16 thetaBps,
        uint128 bond,
        bool isTeam,
        bool queued
    );
    event ProposalActivated(
        uint256 indexed id,
        bytes32 conditionId,
        uint64 passPoolId,
        uint64 failPoolId,
        uint40 tradingStart,
        uint40 tradingEnd,
        address passToken,
        address failToken,
        address passQuote,
        address failQuote
    );
    event LiquidityMigrated(uint256 indexed id, uint256 base, uint256 quote);
    event ProposalFinalized(uint256 indexed id, bool passed, uint256 twapPass, uint256 twapFail);
    event LiquidityRestored(
        uint256 indexed id, uint256 base, uint256 quote, uint256 leftoverBase, uint256 leftoverQuote
    );
    event BondSettled(uint256 indexed id, address indexed proposer, uint128 bond, bool refunded);
    event ProposalExecuted(uint256 indexed id);
    event ProposalExecutionFailed(uint256 indexed id, bytes reason);
    event ProposalCancelled(uint256 indexed id);
    event TrancheReleased(uint8 indexed index, uint256 amount, address to);
    event BudgetClaimed(address indexed to, uint256 amount);
    event BudgetRateSet(uint128 perMonth);
    event ConfigUpdated(GovConfig config);
    event FounderSet(address founder);
    event Minted(address indexed to, uint256 amount);
    event TransferExecuted(address indexed token, address indexed to, uint256 amount);
    event CallExecuted(address indexed target, bytes data, bytes result);
    event BuybackExecuted(uint256 quoteIn, uint256 tokensBurned);
    event RedemptionStarted(uint256 quotePool, uint256 supplySnapshot);
    event RedemptionClaimed(address indexed holder, uint256 burned, uint256 paid);
    event PerformanceUnlockStarted(uint8 indexed index, uint256 cumulative, uint40 at);
    event PerformanceUnlocked(uint8 indexed index, uint256 amount);

    // lifecycle
    function initialize(InitArgs calldata args) external;
    function launch(uint256 contributorTokens, uint256 liquidityQuote, uint128 price) external;

    // proposals
    function propose(ActionType t, bytes calldata data, string calldata memo, PermitArgs calldata bondPermit)
        external
        returns (uint256 id);
    function finalizeProposal(uint256 id) external;
    function executeProposal(uint256 id) external;
    function executeAction(uint256 id) external;

    // founder
    function claimBudget() external returns (uint256 paid);
    function startPerformanceUnlock(uint8 index) external;
    function completePerformanceUnlock(uint8 index) external;

    // holders
    function redeem(uint256 tokenAmount) external returns (uint256 quoteOut);

    // views
    function projectId() external view returns (uint256);
    function factory() external view returns (address);
    function token() external view returns (address);
    function quote() external view returns (address);
    function amm() external view returns (address);
    function vault() external view returns (address);
    function raise() external view returns (address);
    function founder() external view returns (address);
    function spotPoolId() external view returns (uint64);
    function raisePrice() external view returns (uint128);
    function launchedAt() external view returns (uint40);
    function state() external view returns (ProjectState);
    function budgetPerMonth() external view returns (uint128);
    function budgetLastClaim() external view returns (uint40);
    function budgetAccrued() external view returns (uint256);
    function availableQuote() external view returns (uint256);
    function bondsHeld() external view returns (uint256);
    function proposalCount() external view returns (uint256);
    function activeProposalId() external view returns (uint256);
    function queuedRedemptionId() external view returns (uint256);
    function proposal(uint256 id) external view returns (Proposal memory);
    function config() external view returns (GovConfig memory);
    function tranches() external view returns (Tranche[] memory);
    function perfTranches() external view returns (PerfState[] memory);
    function perfCliffEnd() external view returns (uint40);
    function perfUnlockWindow() external view returns (uint40);
    function redemptionQuote() external view returns (uint256);
    function redemptionSupply() external view returns (uint256);
    function projectedVerdict(uint256 id)
        external
        view
        returns (bool passing, uint256 twapPass, uint256 twapFail);
    function nav() external view returns (uint256 quoteAssets, uint256 circulating, uint256 navPerToken);
}

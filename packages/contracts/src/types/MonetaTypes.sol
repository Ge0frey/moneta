// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @dev Prices are quote-raw-units per base-raw-unit scaled by 1e36, so 6/18-decimal pairs keep precision.
uint256 constant PRICE_SCALE = 1e36;
/// @dev Basis points denominator.
uint256 constant BPS = 10_000;
/// @dev Raise prices are expressed as quote raw units per 1e18 token raw units (one whole 18-decimal token).
uint256 constant TOKEN_UNIT = 1e18;
/// @dev Budget accrual period.
uint256 constant MONTH = 30 days;

enum RaiseStatus {
    Open,
    Failed,
    Succeeded
}

enum Outcome {
    Unresolved,
    Pass,
    Fail
}

enum ProposalStatus {
    None,
    Queued,
    Active,
    Passed,
    Failed,
    Executed,
    Cancelled
}

enum ActionType {
    TrancheRelease,
    Transfer,
    SetBudget,
    Mint,
    Buyback,
    UpdateConfig,
    SetFounder,
    Call,
    Redeem
}

enum ProjectState {
    Active,
    Redeemed
}

/// @notice Futarchy parameters of a project. Changeable only through a passed UpdateConfig proposal.
struct GovConfig {
    int16 thetaTrancheBps; // threshold for founder TrancheRelease proposals
    int16 thetaTeamBps; // threshold for other founder proposals
    int16 thetaCommunityBps; // threshold for everyone else (including Redeem)
    uint16 proposalLiquidityBps; // share of spot POL migrated into the PASS/FAIL pools
    uint16 maxStepBps; // max observation move per second, in bps of the start price
    uint40 warmup; // seconds between activation and TWAP start
    uint40 duration; // TWAP window length in seconds
    uint40 executionGrace; // retry window for a passed proposal whose execution failed
    uint128 bond; // proposal bond in quote raw units
}

/// @notice One founder performance tranche: `amount` tokens mint when the spot TWAP holds at `multipleX100`/100 x price.
struct PerfTranche {
    uint16 multipleX100;
    uint128 amount;
}

/// @notice Everything a founder specifies when creating a raise.
struct RaiseParams {
    string name;
    string symbol;
    address quote;
    address founder;
    uint128 price; // quote raw units per 1e18 token raw units
    uint128 minRaise;
    uint128 maxRaise;
    uint40 start;
    uint40 end;
    uint16 liquidityBps; // share of net raise seeded as spot liquidity
    uint128 budgetPerMonth; // quote raw units per 30 days
    uint16[] trancheBps; // milestone tranches in bps of the launch treasury
    PerfTranche[] perf;
    uint40 perfCliff;
    uint40 perfUnlockWindow;
    GovConfig gov;
}

/// @notice Project-level configuration carried from the raise into the launched Treasury (ABI-encoded in the Raise).
struct ProjectConfig {
    string name;
    string symbol;
    address founder;
    uint128 budgetPerMonth;
    uint16[] trancheBps;
    PerfTranche[] perf;
    uint40 perfCliff;
    uint40 perfUnlockWindow;
    GovConfig gov;
}

/// @notice Protocol bounds for new raises and governance configs (set by the protocol Safe, never retroactive for raises).
struct Bounds {
    uint40 minRaiseWindow;
    uint40 maxRaiseWindow;
    uint40 maxStartDelay;
    uint40 finalizeGrace;
    uint16 minLiquidityBps;
    uint16 maxLiquidityBps;
    uint8 maxTranches;
    uint8 maxPerfTranches;
    uint40 minWarmup;
    uint40 maxWarmup;
    uint40 minDuration;
    uint40 maxDuration;
    uint16 minProposalLiquidityBps;
    uint16 maxProposalLiquidityBps;
    uint16 minMaxStepBps;
    uint16 maxMaxStepBps;
    int16 minTheta;
    int16 maxTheta;
    uint128 minBond;
    uint40 minExecutionGrace;
    uint16 maxMintBps;
    uint32 maxMemoBytes;
}

/// @notice Optional EIP-2612 permit attached to a call (ignored when `enabled` is false).
struct PermitArgs {
    bool enabled;
    uint256 value;
    uint256 deadline;
    uint8 v;
    bytes32 r;
    bytes32 s;
}

/// @notice A milestone tranche. `amount` is fixed at launch from `bps` of the launch treasury.
struct Tranche {
    uint16 bps;
    uint128 amount;
    bool released;
}

/// @notice A founder performance tranche and its unlock progress.
struct PerfState {
    uint16 multipleX100;
    uint128 amount;
    uint40 unlockStart;
    bool done;
    uint256 cumulativeStart;
}

/// @notice A futarchy proposal.
struct Proposal {
    address proposer;
    ActionType actionType;
    ProposalStatus status;
    bool isTeam;
    int16 thetaBps;
    uint40 createdAt;
    uint40 tradingStart;
    uint40 tradingEnd;
    uint64 passPoolId;
    uint64 failPoolId;
    uint128 bond;
    uint128 migratedBase;
    uint128 migratedQuote;
    bytes32 conditionId;
    uint256 twapPass;
    uint256 twapFail;
    bytes32 memoHash;
    bytes actionData;
}

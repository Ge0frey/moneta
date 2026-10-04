/** Protocol constants — mirror packages/contracts/src/types/MonetaTypes.sol exactly. */
export const PRICE_SCALE = 10n ** 36n;
export const BPS = 10_000n;
export const TOKEN_UNIT = 10n ** 18n;
export const MONTH = 30n * 86_400n;
export const TOKEN_DECIMALS = 18;
export const MAX_UINT256 = 2n ** 256n - 1n;
export const MAX_UINT40 = 2n ** 40n - 1n;

export const RaiseStatus = { Open: 0, Failed: 1, Succeeded: 2 } as const;
export type RaiseStatus = (typeof RaiseStatus)[keyof typeof RaiseStatus];

export const Outcome = { Unresolved: 0, Pass: 1, Fail: 2 } as const;
export type Outcome = (typeof Outcome)[keyof typeof Outcome];

export const ProposalStatus = {
  None: 0,
  Queued: 1,
  Active: 2,
  Passed: 3,
  Failed: 4,
  Executed: 5,
  Cancelled: 6,
} as const;
export type ProposalStatus = (typeof ProposalStatus)[keyof typeof ProposalStatus];

export const ActionType = {
  TrancheRelease: 0,
  Transfer: 1,
  SetBudget: 2,
  Mint: 3,
  Buyback: 4,
  UpdateConfig: 5,
  SetFounder: 6,
  Call: 7,
  Redeem: 8,
} as const;
export type ActionType = (typeof ActionType)[keyof typeof ActionType];
export const ACTION_NAMES = Object.keys(ActionType) as (keyof typeof ActionType)[];

export const ProjectState = { Active: 0, Redeemed: 1 } as const;
export type ProjectState = (typeof ProjectState)[keyof typeof ProjectState];

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  0: "None",
  1: "Queued",
  2: "Live",
  3: "Passed",
  4: "Failed",
  5: "Executed",
  6: "Cancelled",
};

export const RAISE_STATUS_LABEL: Record<RaiseStatus, string> = {
  0: "Raising",
  1: "Refunding",
  2: "Launched",
};

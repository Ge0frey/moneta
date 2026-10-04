import type { Address, Hex } from "viem";

/** TS mirrors of the Solidity structs (MonetaTypes.sol). */

export type GovConfig = {
  thetaTrancheBps: number;
  thetaTeamBps: number;
  thetaCommunityBps: number;
  proposalLiquidityBps: number;
  maxStepBps: number;
  warmup: number;
  duration: number;
  executionGrace: number;
  bond: bigint;
};

export type PerfTranche = { multipleX100: number; amount: bigint };

export type RaiseParams = {
  name: string;
  symbol: string;
  quote: Address;
  founder: Address;
  price: bigint;
  minRaise: bigint;
  maxRaise: bigint;
  start: number;
  end: number;
  liquidityBps: number;
  budgetPerMonth: bigint;
  trancheBps: number[];
  perf: PerfTranche[];
  perfCliff: number;
  perfUnlockWindow: number;
  gov: GovConfig;
};

export type Bounds = {
  minRaiseWindow: number;
  maxRaiseWindow: number;
  maxStartDelay: number;
  finalizeGrace: number;
  minLiquidityBps: number;
  maxLiquidityBps: number;
  maxTranches: number;
  maxPerfTranches: number;
  minWarmup: number;
  maxWarmup: number;
  minDuration: number;
  maxDuration: number;
  minProposalLiquidityBps: number;
  maxProposalLiquidityBps: number;
  minMaxStepBps: number;
  maxMaxStepBps: number;
  minTheta: number;
  maxTheta: number;
  minBond: bigint;
  minExecutionGrace: number;
  maxMintBps: number;
  maxMemoBytes: number;
};

export type PermitArgs = {
  enabled: boolean;
  value: bigint;
  deadline: bigint;
  v: number;
  r: Hex;
  s: Hex;
};

export const NO_PERMIT: PermitArgs = {
  enabled: false,
  value: 0n,
  deadline: 0n,
  v: 0,
  r: "0x0000000000000000000000000000000000000000000000000000000000000000",
  s: "0x0000000000000000000000000000000000000000000000000000000000000000",
};

export type Tranche = { bps: number; amount: bigint; released: boolean };

export type PerfState = {
  multipleX100: number;
  amount: bigint;
  unlockStart: number;
  done: boolean;
  cumulativeStart: bigint;
};

export type Proposal = {
  proposer: Address;
  actionType: number;
  status: number;
  isTeam: boolean;
  thetaBps: number;
  createdAt: number;
  tradingStart: number;
  tradingEnd: number;
  passPoolId: bigint;
  failPoolId: bigint;
  bond: bigint;
  migratedBase: bigint;
  migratedQuote: bigint;
  conditionId: Hex;
  twapPass: bigint;
  twapFail: bigint;
  memoHash: Hex;
  actionData: Hex;
};

export type PoolView = {
  base: Address;
  quote: Address;
  owner: Address;
  feeBps: number;
  closed: boolean;
  reserveBase: bigint;
  reserveQuote: bigint;
  observation: bigint;
  cumulative: bigint;
  maxStepPerSecond: bigint;
  lastUpdate: bigint;
  twapStart: bigint;
  twapEnd: bigint;
};

import { erc20Abi, type Address, type PublicClient } from "viem";
import type { DeploymentRecord } from "./addresses";
import { ProposalStatus } from "./constants";
import { decodeAction, type ProposalAction } from "./actions";
import {
  conditionalVaultAbi,
  monetaAmmAbi,
  monetaFactoryAbi,
  raiseAbi,
  treasuryAbi,
} from "./generated/abis";
import { projectVerdict, type VerdictProjection } from "./math/oracle";
import type { Bounds, GovConfig, PerfState, PoolView, Proposal, Tranche } from "./types";

/**
 * Chain-authoritative readers (Multicall3). Gates, amounts and verdicts in the UI come from here — never from the
 * indexer.
 */

export async function chainNow(client: PublicClient): Promise<bigint> {
  const block = await client.getBlock({ blockTag: "latest" });
  return block.timestamp;
}

// ── factory ─────────────────────────────────────────────────────────────────

export type FactoryState = {
  raiseCount: bigint;
  raiseFeeBps: number;
  poolFeeBps: number;
  feeRecipient: Address;
  creationPaused: boolean;
  bounds: Bounds;
};

export async function readFactory(
  client: PublicClient,
  d: DeploymentRecord,
): Promise<FactoryState> {
  const f = { address: d.factory, abi: monetaFactoryAbi } as const;
  const [raiseCount, raiseFeeBps, poolFeeBps, feeRecipient, creationPaused, bounds] =
    await client.multicall({
      allowFailure: false,
      contracts: [
        { ...f, functionName: "raiseCount" },
        { ...f, functionName: "raiseFeeBps" },
        { ...f, functionName: "poolFeeBps" },
        { ...f, functionName: "feeRecipient" },
        { ...f, functionName: "creationPaused" },
        { ...f, functionName: "bounds" },
      ],
    });
  return {
    raiseCount,
    raiseFeeBps,
    poolFeeBps,
    feeRecipient,
    creationPaused,
    bounds: bounds as Bounds,
  };
}

// ── raise ───────────────────────────────────────────────────────────────────

export type RaiseState = {
  address: Address;
  raiseId: bigint;
  quote: Address;
  founder: Address;
  price: bigint;
  minRaise: bigint;
  maxRaise: bigint;
  start: number;
  end: number;
  finalizeGrace: number;
  liquidityBps: number;
  feeBps: number;
  status: number;
  totalContributed: bigint;
  contributorCount: bigint;
  accepted: bigint;
  contributorTokens: bigint;
  token: Address;
  treasury: Address;
  account?: {
    contribution: bigint;
    claimed: boolean;
    claimableTokens: bigint;
    claimableRefund: bigint;
    quoteBalance: bigint;
    quoteAllowance: bigint;
  };
};

export async function readRaise(
  client: PublicClient,
  raise: Address,
  account?: Address,
): Promise<RaiseState> {
  const r = { address: raise, abi: raiseAbi } as const;
  const base = await client.multicall({
    allowFailure: false,
    contracts: [
      { ...r, functionName: "raiseId" },
      { ...r, functionName: "quote" },
      { ...r, functionName: "founder" },
      { ...r, functionName: "price" },
      { ...r, functionName: "minRaise" },
      { ...r, functionName: "maxRaise" },
      { ...r, functionName: "start" },
      { ...r, functionName: "end" },
      { ...r, functionName: "finalizeGrace" },
      { ...r, functionName: "liquidityBps" },
      { ...r, functionName: "feeBps" },
      { ...r, functionName: "status" },
      { ...r, functionName: "totalContributed" },
      { ...r, functionName: "contributorCount" },
      { ...r, functionName: "accepted" },
      { ...r, functionName: "contributorTokens" },
      { ...r, functionName: "token" },
      { ...r, functionName: "treasury" },
    ],
  });
  const state: RaiseState = {
    address: raise,
    raiseId: base[0],
    quote: base[1],
    founder: base[2],
    price: base[3],
    minRaise: base[4],
    maxRaise: base[5],
    start: Number(base[6]),
    end: Number(base[7]),
    finalizeGrace: Number(base[8]),
    liquidityBps: base[9],
    feeBps: base[10],
    status: base[11],
    totalContributed: base[12],
    contributorCount: base[13],
    accepted: base[14],
    contributorTokens: base[15],
    token: base[16],
    treasury: base[17],
  };
  if (account) {
    const [contribution, claimed, preview, quoteBalance, quoteAllowance] = await client.multicall({
      allowFailure: false,
      contracts: [
        { ...r, functionName: "contributionOf", args: [account] },
        { ...r, functionName: "claimed", args: [account] },
        { ...r, functionName: "previewClaim", args: [account] },
        { address: state.quote, abi: erc20Abi, functionName: "balanceOf", args: [account] },
        { address: state.quote, abi: erc20Abi, functionName: "allowance", args: [account, raise] },
      ],
    });
    state.account = {
      contribution,
      claimed,
      claimableTokens: preview[0],
      claimableRefund: preview[1],
      quoteBalance,
      quoteAllowance,
    };
  }
  return state;
}

// ── pools ───────────────────────────────────────────────────────────────────

export async function readPool(
  client: PublicClient,
  amm: Address,
  poolId: bigint,
): Promise<PoolView> {
  const v = await client.readContract({
    address: amm,
    abi: monetaAmmAbi,
    functionName: "getPool",
    args: [poolId],
  });
  return {
    ...v,
    lastUpdate: BigInt(v.lastUpdate),
    twapStart: BigInt(v.twapStart),
    twapEnd: BigInt(v.twapEnd),
  };
}

// ── project / treasury ──────────────────────────────────────────────────────

export type ProjectView = {
  treasury: Address;
  projectId: bigint;
  token: Address;
  quote: Address;
  raise: Address;
  founder: Address;
  spotPoolId: bigint;
  raisePrice: bigint;
  launchedAt: number;
  state: number;
  budgetPerMonth: bigint;
  budgetAccrued: bigint;
  availableQuote: bigint;
  bondsHeld: bigint;
  proposalCount: bigint;
  activeProposalId: bigint;
  queuedRedemptionId: bigint;
  config: GovConfig;
  tranches: Tranche[];
  perf: PerfState[];
  perfCliffEnd: number;
  perfUnlockWindow: number;
  redemptionQuote: bigint;
  redemptionSupply: bigint;
  nav: { quoteAssets: bigint; circulating: bigint; navPerToken: bigint };
  tokenMeta: { name: string; symbol: string; decimals: number; totalSupply: bigint };
  quoteMeta: { symbol: string; decimals: number };
  spot: PoolView;
};

export async function readProject(
  client: PublicClient,
  d: DeploymentRecord,
  treasury: Address,
): Promise<ProjectView> {
  const t = { address: treasury, abi: treasuryAbi } as const;
  const res = await client.multicall({
    allowFailure: false,
    contracts: [
      { ...t, functionName: "projectId" },
      { ...t, functionName: "token" },
      { ...t, functionName: "quote" },
      { ...t, functionName: "raise" },
      { ...t, functionName: "founder" },
      { ...t, functionName: "spotPoolId" },
      { ...t, functionName: "raisePrice" },
      { ...t, functionName: "launchedAt" },
      { ...t, functionName: "state" },
      { ...t, functionName: "budgetPerMonth" },
      { ...t, functionName: "budgetAccrued" },
      { ...t, functionName: "availableQuote" },
      { ...t, functionName: "bondsHeld" },
      { ...t, functionName: "proposalCount" },
      { ...t, functionName: "activeProposalId" },
      { ...t, functionName: "queuedRedemptionId" },
      { ...t, functionName: "config" },
      { ...t, functionName: "tranches" },
      { ...t, functionName: "perfTranches" },
      { ...t, functionName: "perfCliffEnd" },
      { ...t, functionName: "perfUnlockWindow" },
      { ...t, functionName: "redemptionQuote" },
      { ...t, functionName: "redemptionSupply" },
      { ...t, functionName: "nav" },
    ],
  });
  const token = res[1];
  const quote = res[2];
  const [name, symbol, decimals, totalSupply, qSymbol, qDecimals] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: token, abi: erc20Abi, functionName: "name" },
      { address: token, abi: erc20Abi, functionName: "symbol" },
      { address: token, abi: erc20Abi, functionName: "decimals" },
      { address: token, abi: erc20Abi, functionName: "totalSupply" },
      { address: quote, abi: erc20Abi, functionName: "symbol" },
      { address: quote, abi: erc20Abi, functionName: "decimals" },
    ],
  });
  const spot = await readPool(client, d.amm, res[5]);
  return {
    treasury,
    projectId: res[0],
    token,
    quote,
    raise: res[3],
    founder: res[4],
    spotPoolId: res[5],
    raisePrice: res[6],
    launchedAt: Number(res[7]),
    state: res[8],
    budgetPerMonth: res[9],
    budgetAccrued: res[10],
    availableQuote: res[11],
    bondsHeld: res[12],
    proposalCount: res[13],
    activeProposalId: res[14],
    queuedRedemptionId: res[15],
    config: res[16] as GovConfig,
    tranches: res[17] as unknown as Tranche[],
    perf: (res[18] as unknown as PerfState[]).map((p) => ({
      ...p,
      unlockStart: Number(p.unlockStart),
    })),
    perfCliffEnd: Number(res[19]),
    perfUnlockWindow: Number(res[20]),
    redemptionQuote: res[21],
    redemptionSupply: res[22],
    nav: { quoteAssets: res[23][0], circulating: res[23][1], navPerToken: res[23][2] },
    tokenMeta: { name, symbol, decimals, totalSupply },
    quoteMeta: { symbol: qSymbol, decimals: qDecimals },
    spot,
  };
}

// ── proposals ───────────────────────────────────────────────────────────────

export type ProposalView = {
  id: bigint;
  proposal: Proposal;
  action: ProposalAction;
  passPool?: PoolView;
  failPool?: PoolView;
  tokens?: { passToken: Address; failToken: Address; passQuote: Address; failQuote: Address };
  outcome: number;
  /** Projection from chain state at `now` (exact mirror of the on-chain TWAP math). */
  projection?: VerdictProjection;
  now: bigint;
};

export async function readProposal(
  client: PublicClient,
  d: DeploymentRecord,
  project: { treasury: Address; token: Address; quote: Address },
  id: bigint,
): Promise<ProposalView> {
  const [raw, now] = await Promise.all([
    client.readContract({
      address: project.treasury,
      abi: treasuryAbi,
      functionName: "proposal",
      args: [id],
    }),
    chainNow(client),
  ]);
  const proposal = raw as unknown as Proposal;
  const view: ProposalView = {
    id,
    proposal,
    action: decodeAction(proposal.actionType, proposal.actionData),
    outcome: 0,
    now,
  };
  if (proposal.status === ProposalStatus.Queued || proposal.passPoolId === 0n) return view;

  const [passPool, failPool, tokenPair, quotePair, outcome] = await Promise.all([
    readPool(client, d.amm, proposal.passPoolId),
    readPool(client, d.amm, proposal.failPoolId),
    client.readContract({
      address: d.vault,
      abi: conditionalVaultAbi,
      functionName: "tokensOf",
      args: [proposal.conditionId, project.token],
    }),
    client.readContract({
      address: d.vault,
      abi: conditionalVaultAbi,
      functionName: "tokensOf",
      args: [proposal.conditionId, project.quote],
    }),
    client.readContract({
      address: d.vault,
      abi: conditionalVaultAbi,
      functionName: "outcomeOf",
      args: [proposal.conditionId],
    }),
  ]);
  view.passPool = passPool;
  view.failPool = failPool;
  view.tokens = {
    passToken: tokenPair[0],
    failToken: tokenPair[1],
    passQuote: quotePair[0],
    failQuote: quotePair[1],
  };
  view.outcome = outcome;
  view.projection =
    proposal.status === ProposalStatus.Active
      ? projectVerdict(passPool, failPool, now, proposal.thetaBps)
      : {
          passing:
            proposal.status === ProposalStatus.Passed ||
            proposal.status === ProposalStatus.Executed,
          twapPass: proposal.twapPass,
          twapFail: proposal.twapFail,
          premiumBps:
            proposal.twapFail === 0n
              ? 0
              : Number(((proposal.twapPass - proposal.twapFail) * 10_000n) / proposal.twapFail),
          thresholdBps: proposal.thetaBps,
        };
  return view;
}

/** Balances of many tokens for one account in one multicall. */
export async function readBalances(
  client: PublicClient,
  account: Address,
  tokens: Address[],
): Promise<Record<Address, bigint>> {
  if (tokens.length === 0) return {};
  const res = await client.multicall({
    allowFailure: false,
    contracts: tokens.map(
      (t) => ({ address: t, abi: erc20Abi, functionName: "balanceOf", args: [account] }) as const,
    ),
  });
  return Object.fromEntries(tokens.map((t, i) => [t, res[i] as bigint]));
}

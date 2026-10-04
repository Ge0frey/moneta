import { indexer, type Project } from "envio";
import { bumpProtocol, eventId, lower, proposalKey } from "./utils.js";

type Ev = {
  block: { number: number; timestamp: number };
  logIndex: number;
  transaction: { hash: string };
};

function flow(
  project: string,
  e: Ev,
  kind: string,
  amount: bigint,
  extra: { account?: string; token?: string; proposalId?: bigint } = {},
) {
  return {
    id: eventId(e),
    project_id: project,
    kind,
    amount,
    account: extra.account,
    token: extra.token,
    proposalId: extra.proposalId,
    timestamp: BigInt(e.block.timestamp),
    txHash: e.transaction.hash,
  };
}

indexer.onEvent({ contract: "Treasury", event: "Launched" }, async ({ event, context }) => {
  const id = lower(event.srcAddress);
  const project = await context.Project.getOrThrow(id);
  const spotId = event.params.spotPoolId.toString();
  const pool = await context.Pool.get(spotId);
  if (pool) context.Pool.set({ ...pool, kind: "SPOT", project_id: id });
  context.Project.set({
    ...project,
    spotPool_id: spotId,
    contributorTokens: event.params.contributorTokens,
    liquidityTokens: event.params.liquidityTokens,
    liquidityQuote: event.params.liquidityQuote,
    treasuryQuoteAtLaunch: event.params.treasuryQuote,
    launchedAt: BigInt(event.block.timestamp),
    lastPrice: pool?.price ?? 0n,
  });
  context.TreasuryFlow.set(flow(id, event, "LAUNCH", event.params.treasuryQuote));
});

indexer.onEvent({ contract: "Treasury", event: "ProposalCreated" }, async ({ event, context }) => {
  const treasury = lower(event.srcAddress);
  const project = await context.Project.getOrThrow(treasury);
  context.Proposal.set({
    id: proposalKey(treasury, event.params.id),
    project_id: treasury,
    proposalId: event.params.id,
    proposer: lower(event.params.proposer),
    isTeam: event.params.isTeam,
    actionType: Number(event.params.actionType),
    actionData: event.params.actionData,
    memo: event.params.memo,
    memoHash: event.params.memoHash,
    thetaBps: Number(event.params.thetaBps),
    bond: event.params.bond,
    status: event.params.queued ? "QUEUED" : "ACTIVE",
    executionFailed: false,
    executionError: undefined,
    conditionId: undefined,
    passPool_id: undefined,
    failPool_id: undefined,
    passToken: undefined,
    failToken: undefined,
    passQuote: undefined,
    failQuote: undefined,
    tradingStart: undefined,
    tradingEnd: undefined,
    twapPass: undefined,
    twapFail: undefined,
    passed: undefined,
    createdAt: BigInt(event.block.timestamp),
    createdTx: event.transaction.hash,
    finalizedAt: undefined,
    volumeQuote: 0n,
    tradeCount: 0,
  });
  context.Project.set({ ...project, proposalCount: project.proposalCount + 1 });
  await bumpProtocol(context, event.block.timestamp, (p) => ({
    proposalCount: p.proposalCount + 1,
  }));
});

indexer.onEvent(
  { contract: "Treasury", event: "ProposalActivated" },
  async ({ event, context }) => {
    const treasury = lower(event.srcAddress);
    const key = proposalKey(treasury, event.params.id);
    const proposal = await context.Proposal.getOrThrow(key);
    const passId = event.params.passPoolId.toString();
    const failId = event.params.failPoolId.toString();
    for (const [pid, kind] of [
      [passId, "PASS"],
      [failId, "FAIL"],
    ] as const) {
      const pool = await context.Pool.get(pid);
      if (pool) context.Pool.set({ ...pool, kind, project_id: treasury, proposal_id: key });
    }
    context.Proposal.set({
      ...proposal,
      status: "ACTIVE",
      conditionId: event.params.conditionId,
      passPool_id: passId,
      failPool_id: failId,
      passToken: lower(event.params.passToken),
      failToken: lower(event.params.failToken),
      passQuote: lower(event.params.passQuote),
      failQuote: lower(event.params.failQuote),
      tradingStart: BigInt(event.params.tradingStart),
      tradingEnd: BigInt(event.params.tradingEnd),
    });
    const project = await context.Project.getOrThrow(treasury);
    context.Project.set({ ...project, activeProposal_id: key });
  },
);

indexer.onEvent(
  { contract: "Treasury", event: "ProposalFinalized" },
  async ({ event, context }) => {
    const treasury = lower(event.srcAddress);
    const key = proposalKey(treasury, event.params.id);
    const proposal = await context.Proposal.getOrThrow(key);
    const passed = event.params.passed;
    context.Proposal.set({
      ...proposal,
      status: passed ? "PASSED" : "FAILED",
      passed,
      twapPass: event.params.twapPass,
      twapFail: event.params.twapFail,
      finalizedAt: BigInt(event.block.timestamp),
    });
    const project = await context.Project.getOrThrow(treasury);
    if (project.activeProposal_id === key)
      context.Project.set({ ...project, activeProposal_id: undefined });
    await bumpProtocol(context, event.block.timestamp, (p) =>
      passed ? { verdictsPassed: p.verdictsPassed + 1 } : { verdictsFailed: p.verdictsFailed + 1 },
    );
  },
);

indexer.onEvent({ contract: "Treasury", event: "ProposalExecuted" }, async ({ event, context }) => {
  const key = proposalKey(event.srcAddress, event.params.id);
  const proposal = await context.Proposal.getOrThrow(key);
  context.Proposal.set({
    ...proposal,
    status: "EXECUTED",
    executionFailed: false,
    executionError: undefined,
  });
});

indexer.onEvent(
  { contract: "Treasury", event: "ProposalExecutionFailed" },
  async ({ event, context }) => {
    const key = proposalKey(event.srcAddress, event.params.id);
    const proposal = await context.Proposal.getOrThrow(key);
    context.Proposal.set({
      ...proposal,
      executionFailed: true,
      executionError: event.params.reason,
    });
  },
);

indexer.onEvent(
  { contract: "Treasury", event: "ProposalCancelled" },
  async ({ event, context }) => {
    const key = proposalKey(event.srcAddress, event.params.id);
    const proposal = await context.Proposal.getOrThrow(key);
    context.Proposal.set({ ...proposal, status: "CANCELLED" });
  },
);

indexer.onEvent({ contract: "Treasury", event: "BondSettled" }, async ({ event, context }) => {
  if (!event.params.refunded) return;
  context.TreasuryFlow.set(
    flow(lower(event.srcAddress), event, "BOND_REFUND", event.params.bond, {
      account: lower(event.params.proposer),
      proposalId: event.params.id,
    }),
  );
});

indexer.onEvent({ contract: "Treasury", event: "LiquidityRestored" }, async () => {
  // Pool reserves are tracked from AMM events; nothing extra to derive.
});

async function release(
  context: { Project: { getOrThrow: (id: string) => Promise<Project>; set: (p: Project) => void } },
  id: string,
  amount: bigint,
) {
  const project = await context.Project.getOrThrow(id);
  context.Project.set({ ...project, releasedQuote: project.releasedQuote + amount });
}

indexer.onEvent({ contract: "Treasury", event: "TrancheReleased" }, async ({ event, context }) => {
  const id = lower(event.srcAddress);
  context.TreasuryFlow.set(
    flow(id, event, "TRANCHE", event.params.amount, { account: lower(event.params.to) }),
  );
  await release(context, id, event.params.amount);
});

indexer.onEvent({ contract: "Treasury", event: "BudgetClaimed" }, async ({ event, context }) => {
  const id = lower(event.srcAddress);
  context.TreasuryFlow.set(
    flow(id, event, "BUDGET", event.params.amount, { account: lower(event.params.to) }),
  );
  await release(context, id, event.params.amount);
});

indexer.onEvent({ contract: "Treasury", event: "BudgetRateSet" }, async ({ event, context }) => {
  const id = lower(event.srcAddress);
  const project = await context.Project.getOrThrow(id);
  context.Project.set({ ...project, budgetPerMonth: event.params.perMonth });
  context.TreasuryFlow.set(flow(id, event, "BUDGET_RATE", event.params.perMonth));
});

indexer.onEvent({ contract: "Treasury", event: "FounderSet" }, async ({ event, context }) => {
  const id = lower(event.srcAddress);
  const project = await context.Project.getOrThrow(id);
  context.Project.set({ ...project, founder: lower(event.params.founder) });
  context.TreasuryFlow.set(
    flow(id, event, "FOUNDER", 0n, { account: lower(event.params.founder) }),
  );
});

indexer.onEvent({ contract: "Treasury", event: "Minted" }, async ({ event, context }) => {
  context.TreasuryFlow.set(
    flow(lower(event.srcAddress), event, "MINT", event.params.amount, {
      account: lower(event.params.to),
    }),
  );
});

indexer.onEvent({ contract: "Treasury", event: "TransferExecuted" }, async ({ event, context }) => {
  const id = lower(event.srcAddress);
  context.TreasuryFlow.set(
    flow(id, event, "TRANSFER", event.params.amount, {
      account: lower(event.params.to),
      token: lower(event.params.token),
    }),
  );
  const project = await context.Project.getOrThrow(id);
  if (lower(event.params.token) === project.quote) await release(context, id, event.params.amount);
});

indexer.onEvent({ contract: "Treasury", event: "BuybackExecuted" }, async ({ event, context }) => {
  context.TreasuryFlow.set(flow(lower(event.srcAddress), event, "BUYBACK", event.params.quoteIn));
});

indexer.onEvent({ contract: "Treasury", event: "CallExecuted" }, async ({ event, context }) => {
  context.TreasuryFlow.set(
    flow(lower(event.srcAddress), event, "CALL", 0n, { account: lower(event.params.target) }),
  );
});

indexer.onEvent(
  { contract: "Treasury", event: "RedemptionStarted" },
  async ({ event, context }) => {
    const id = lower(event.srcAddress);
    const project = await context.Project.getOrThrow(id);
    context.Project.set({
      ...project,
      state: "REDEEMED",
      redemptionQuote: event.params.quotePool,
      redemptionSupply: event.params.supplySnapshot,
    });
    context.TreasuryFlow.set(flow(id, event, "REDEMPTION_START", event.params.quotePool));
    const founder = await context.Founder.get(project.founder);
    if (founder) context.Founder.set({ ...founder, redeemedCount: founder.redeemedCount + 1 });
    await bumpProtocol(context, event.block.timestamp, (p) => ({
      redeemedCount: p.redeemedCount + 1,
    }));
  },
);

indexer.onEvent(
  { contract: "Treasury", event: "RedemptionClaimed" },
  async ({ event, context }) => {
    context.TreasuryFlow.set(
      flow(lower(event.srcAddress), event, "REDEMPTION_CLAIM", event.params.paid, {
        account: lower(event.params.holder),
      }),
    );
  },
);

indexer.onEvent(
  { contract: "Treasury", event: "PerformanceUnlocked" },
  async ({ event, context }) => {
    context.TreasuryFlow.set(
      flow(lower(event.srcAddress), event, "PERF_UNLOCK", event.params.amount),
    );
  },
);

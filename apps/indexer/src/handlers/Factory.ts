import { indexer } from "envio";
import { bumpProtocol, lower } from "./utils.js";

// Dynamic registration: every Raise clone, and every launched project's Treasury + ProjectToken.
indexer.contractRegister(
  { contract: "MonetaFactory", event: "RaiseCreated" },
  async ({ event, context }) => {
    context.chain.Raise.add(event.params.raise);
  },
);

indexer.contractRegister(
  { contract: "MonetaFactory", event: "ProjectLaunched" },
  async ({ event, context }) => {
    context.chain.Treasury.add(event.params.treasury);
    context.chain.ProjectToken.add(event.params.token);
  },
);

indexer.onEvent(
  { contract: "MonetaFactory", event: "RaiseCreated" },
  async ({ event, context }) => {
    const p = event.params.params;
    const founderId = lower(event.params.founder);
    const founder = await context.Founder.get(founderId);
    context.Founder.set({
      id: founderId,
      raiseCount: (founder?.raiseCount ?? 0) + 1,
      launchedCount: founder?.launchedCount ?? 0,
      redeemedCount: founder?.redeemedCount ?? 0,
    });

    context.Raise.set({
      id: lower(event.params.raise),
      raiseId: event.params.raiseId,
      address: lower(event.params.raise),
      founder_id: founderId,
      creator: lower(event.params.creator),
      quote: lower(event.params.quote),
      name: p.name,
      symbol: p.symbol,
      price: p.price,
      minRaise: p.minRaise,
      maxRaise: p.maxRaise,
      start: p.start,
      end: p.end,
      liquidityBps: Number(p.liquidityBps),
      budgetPerMonth: p.budgetPerMonth,
      trancheBps: p.trancheBps.map(Number),
      perfMultiples: p.perf.map((x) => Number(x.multipleX100)),
      perfAmounts: p.perf.map((x) => x.amount),
      perfCliff: p.perfCliff,
      perfUnlockWindow: p.perfUnlockWindow,
      thetaTrancheBps: Number(p.gov.thetaTrancheBps),
      thetaTeamBps: Number(p.gov.thetaTeamBps),
      thetaCommunityBps: Number(p.gov.thetaCommunityBps),
      proposalLiquidityBps: Number(p.gov.proposalLiquidityBps),
      maxStepBps: Number(p.gov.maxStepBps),
      warmup: p.gov.warmup,
      duration: p.gov.duration,
      executionGrace: p.gov.executionGrace,
      bond: p.gov.bond,
      memo: event.params.memo,
      memoHash: event.params.memoHash,
      status: "OPEN",
      aborted: false,
      totalContributed: 0n,
      contributorCount: 0,
      accepted: 0n,
      fee: 0n,
      token: undefined,
      treasury: undefined,
      project_id: undefined,
      createdAt: BigInt(event.block.timestamp),
      createdBlock: BigInt(event.block.number),
      createdTx: event.transaction.hash,
      finalizedAt: undefined,
    });

    await bumpProtocol(context, event.block.timestamp, (x) => ({ raiseCount: x.raiseCount + 1 }));
  },
);

indexer.onEvent(
  { contract: "MonetaFactory", event: "ProjectLaunched" },
  async ({ event, context }) => {
    const raiseId = lower(event.params.raise);
    const raise = await context.Raise.getOrThrow(raiseId);
    const treasury = lower(event.params.treasury);
    const token = lower(event.params.token);

    context.Project.set({
      id: treasury,
      projectId: event.params.projectId,
      raise_id: raiseId,
      treasury,
      token,
      quote: raise.quote,
      name: raise.name,
      symbol: raise.symbol,
      founder: raise.founder_id,
      state: "ACTIVE",
      spotPool_id: undefined,
      launchedAt: BigInt(event.block.timestamp),
      contributorTokens: 0n,
      liquidityTokens: 0n,
      liquidityQuote: 0n,
      treasuryQuoteAtLaunch: 0n,
      budgetPerMonth: raise.budgetPerMonth,
      totalSupply: 0n,
      holderCount: 0,
      proposalCount: 0,
      activeProposal_id: undefined,
      lastPrice: 0n,
      volumeQuote: 0n,
      releasedQuote: 0n,
      redemptionQuote: undefined,
      redemptionSupply: undefined,
    });
    context.TokenLink.set({ id: token, project_id: treasury });
    context.Raise.set({ ...raise, token, treasury, project_id: treasury });

    const founder = await context.Founder.get(raise.founder_id);
    if (founder) context.Founder.set({ ...founder, launchedCount: founder.launchedCount + 1 });
    await bumpProtocol(context, event.block.timestamp, (x) => ({
      projectCount: x.projectCount + 1,
    }));
  },
);

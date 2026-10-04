import { indexer } from "envio";
import { bumpProtocol, eventId, lower, spot } from "./utils.js";

const CANDLE_SECONDS = 60n;

indexer.onEvent({ contract: "MonetaAMM", event: "PoolCreated" }, async ({ event, context }) => {
  context.Pool.set({
    id: event.params.poolId.toString(),
    poolId: event.params.poolId,
    kind: "OTHER",
    project_id: undefined,
    proposal_id: undefined,
    base: lower(event.params.base),
    quote: lower(event.params.quote),
    owner: lower(event.params.owner),
    feeBps: Number(event.params.feeBps),
    twapStart: BigInt(event.params.twapStart),
    twapEnd: BigInt(event.params.twapEnd),
    maxStepPerSecond: event.params.maxStepPerSecond,
    reserveBase: 0n,
    reserveQuote: 0n,
    price: 0n,
    observation: 0n,
    cumulative: 0n,
    lastUpdate: BigInt(event.block.timestamp),
    closed: false,
    volumeQuote: 0n,
    swapCount: 0,
    createdAt: BigInt(event.block.timestamp),
  });
});

/** Spot-pool price moves (swaps, and rounding on liquidity re-adds) propagate to the project. */
async function syncProjectPrice(
  context: {
    Project: {
      get: (id: string) => Promise<import("envio").Project | undefined>;
      set: (p: import("envio").Project) => void;
    };
  },
  pool: { kind: string; project_id: string | undefined },
  price: bigint,
) {
  if (pool.kind !== "SPOT" || !pool.project_id || price === 0n) return;
  const project = await context.Project.get(pool.project_id);
  if (project) context.Project.set({ ...project, lastPrice: price });
}

indexer.onEvent({ contract: "MonetaAMM", event: "LiquidityAdded" }, async ({ event, context }) => {
  const pool = await context.Pool.getOrThrow(event.params.poolId.toString());
  const price = spot(event.params.reserveBase, event.params.reserveQuote);
  context.Pool.set({
    ...pool,
    reserveBase: event.params.reserveBase,
    reserveQuote: event.params.reserveQuote,
    price,
  });
  await syncProjectPrice(context, pool, price);
});

indexer.onEvent(
  { contract: "MonetaAMM", event: "LiquidityRemoved" },
  async ({ event, context }) => {
    const pool = await context.Pool.getOrThrow(event.params.poolId.toString());
    const price = spot(event.params.reserveBase, event.params.reserveQuote);
    context.Pool.set({
      ...pool,
      reserveBase: event.params.reserveBase,
      reserveQuote: event.params.reserveQuote,
      price: price === 0n ? pool.price : price,
    });
    await syncProjectPrice(context, pool, price);
  },
);

indexer.onEvent({ contract: "MonetaAMM", event: "PoolClosed" }, async ({ event, context }) => {
  const pool = await context.Pool.getOrThrow(event.params.poolId.toString());
  context.Pool.set({ ...pool, closed: true });
});

indexer.onEvent(
  { contract: "MonetaAMM", event: "ObservationUpdated" },
  async ({ event, context }) => {
    const pool = await context.Pool.getOrThrow(event.params.poolId.toString());
    context.Pool.set({
      ...pool,
      observation: event.params.observation,
      cumulative: event.params.cumulative,
      lastUpdate: BigInt(event.params.timestamp),
    });
    context.PricePoint.set({
      id: eventId(event),
      pool_id: pool.id,
      kind: "OBSERVATION",
      timestamp: BigInt(event.params.timestamp),
      price: pool.price,
      observation: event.params.observation,
      cumulative: event.params.cumulative,
    });
  },
);

indexer.onEvent({ contract: "MonetaAMM", event: "Swap" }, async ({ event, context }) => {
  const pool = await context.Pool.getOrThrow(event.params.poolId.toString());
  const { reserveBase, reserveQuote, baseIn, amountIn, amountOut } = event.params;
  const price = spot(reserveBase, reserveQuote);
  const quoteVolume = baseIn ? amountOut : amountIn;
  const ts = BigInt(event.block.timestamp);

  context.Pool.set({
    ...pool,
    reserveBase,
    reserveQuote,
    price,
    volumeQuote: pool.volumeQuote + quoteVolume,
    swapCount: pool.swapCount + 1,
  });
  context.Swap.set({
    id: eventId(event),
    pool_id: pool.id,
    sender: lower(event.params.sender),
    to: lower(event.params.to),
    baseIn,
    amountIn,
    amountOut,
    quoteVolume,
    protocolFee: event.params.protocolFee,
    price,
    timestamp: ts,
    block: BigInt(event.block.number),
    txHash: event.transaction.hash,
  });
  context.PricePoint.set({
    id: eventId(event),
    pool_id: pool.id,
    kind: "SPOT",
    timestamp: ts,
    price,
    observation: pool.observation,
    cumulative: pool.cumulative,
  });

  const bucket = (ts / CANDLE_SECONDS) * CANDLE_SECONDS;
  const candleId = `${pool.id}-${bucket}`;
  const candle = await context.Candle.get(candleId);
  context.Candle.set(
    candle
      ? {
          ...candle,
          high: price > candle.high ? price : candle.high,
          low: price < candle.low ? price : candle.low,
          close: price,
          volumeQuote: candle.volumeQuote + quoteVolume,
          trades: candle.trades + 1,
        }
      : {
          id: candleId,
          pool_id: pool.id,
          bucketStart: bucket,
          open: pool.price,
          high: price > pool.price ? price : pool.price,
          low: price < pool.price ? price : pool.price,
          close: price,
          volumeQuote: quoteVolume,
          trades: 1,
        },
  );

  if (pool.kind === "SPOT" && pool.project_id) {
    const project = await context.Project.get(pool.project_id);
    if (project)
      context.Project.set({
        ...project,
        lastPrice: price,
        volumeQuote: project.volumeQuote + quoteVolume,
      });
  }
  if ((pool.kind === "PASS" || pool.kind === "FAIL") && pool.proposal_id) {
    const proposal = await context.Proposal.get(pool.proposal_id);
    if (proposal)
      context.Proposal.set({ ...proposal, volumeQuote: proposal.volumeQuote + quoteVolume });
  }
  await bumpProtocol(context, event.block.timestamp, (p) => ({
    volumeQuote: p.volumeQuote + quoteVolume,
  }));
});

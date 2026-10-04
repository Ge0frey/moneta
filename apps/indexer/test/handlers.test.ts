import { createTestIndexer } from "envio";
import { describe, expect, it } from "vitest";

/**
 * Handler tests on simulated events: entity creation, dynamic registration of Raise clones,
 * contribution accounting, protocol counters, pool state, price points and 1-minute candle bucketing.
 * Addresses only need to be well-formed; the factory/AMM addresses come from config.yaml (chain 31337).
 */
const CHAIN = 31337;
const RAISE = "0x1000000000000000000000000000000000000001";
const FOUNDER = "0x2000000000000000000000000000000000000002";
const USDC = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ALICE = "0x3000000000000000000000000000000000000003";
const BOB = "0x4000000000000000000000000000000000000004";
const BASE = "0x5000000000000000000000000000000000000005";
const OWNER = "0x6000000000000000000000000000000000000006";
const T0 = 1_791_000_000;

const usdc = (n: number) => BigInt(Math.round(n * 1e6));
const block = (n: number, ts: number) => ({ number: n, timestamp: ts });

const raiseCreated = {
  contract: "MonetaFactory",
  event: "RaiseCreated",
  block: block(10, T0),
  params: {
    raiseId: 1n,
    raise: RAISE,
    founder: FOUNDER,
    creator: FOUNDER,
    quote: USDC,
    params: {
      name: "Lumen Labs",
      symbol: "LUM",
      quote: USDC,
      founder: FOUNDER,
      price: 100_000n,
      minRaise: usdc(40),
      maxRaise: usdc(200),
      start: BigInt(T0),
      end: BigInt(T0 + 600),
      liquidityBps: 2000n,
      budgetPerMonth: usdc(30),
      trancheBps: [2500n, 2500n],
      perf: [],
      perfCliff: 0n,
      perfUnlockWindow: 0n,
      gov: {
        thetaTrancheBps: 0n,
        thetaTeamBps: 100n,
        thetaCommunityBps: 300n,
        proposalLiquidityBps: 5000n,
        maxStepBps: 100n,
        warmup: 30n,
        duration: 180n,
        executionGrace: 600n,
        bond: usdc(1),
      },
    },
    memoHash: "0x" + "ab".repeat(32),
    memo: "# Lumen\n\nThesis.",
  },
} as const;

const contributed = (n: number, who: string, amount: number, contribution: number, total: number) =>
  ({
    contract: "Raise",
    event: "Contributed",
    srcAddress: RAISE,
    block: block(n, T0 + n),
    params: {
      contributor: who,
      amount: usdc(amount),
      contribution: usdc(contribution),
      totalContributed: usdc(total),
    },
  }) as const;

describe("raise lifecycle", () => {
  it("registers the clone, accounts contributions per backer, and counts a failed raise", async () => {
    const indexer = createTestIndexer();
    await indexer.process({
      chains: {
        [CHAIN]: {
          simulate: [
            raiseCreated,
            contributed(11, ALICE, 10, 10, 10),
            contributed(12, BOB, 5, 5, 15),
            contributed(13, ALICE, 7, 17, 22), // a repeat backer doesn't bump the backer count
            {
              contract: "Raise",
              event: "RaiseFinalized",
              srcAddress: RAISE,
              block: block(20, T0 + 700),
              params: {
                status: 1n,
                accepted: 0n,
                fee: 0n,
                token: "0x0000000000000000000000000000000000000000",
                treasury: "0x0000000000000000000000000000000000000000",
              },
            },
          ],
        },
      },
    } as never);

    const raise = await indexer.Raise.getOrThrow(RAISE.toLowerCase());
    expect(raise.name).toBe("Lumen Labs");
    expect(raise.status).toBe("FAILED");
    expect(raise.totalContributed).toBe(usdc(22));
    expect(raise.contributorCount).toBe(2);
    expect(raise.trancheBps).toEqual([2500, 2500]);

    const alice = await indexer.Contribution.getOrThrow(
      `${RAISE.toLowerCase()}-${ALICE.toLowerCase()}`,
    );
    expect(alice.amount).toBe(usdc(17));
    expect((await indexer.ContributionEvent.getAll()).length).toBe(3);

    const founder = await indexer.Founder.getOrThrow(FOUNDER.toLowerCase());
    expect(founder.raiseCount).toBe(1);

    const protocol = await indexer.Protocol.getOrThrow("moneta");
    expect(protocol.raiseCount).toBe(1);
    expect(protocol.failedRaiseCount).toBe(1);
    expect(protocol.totalRaised).toBe(0n);
  });
});

describe("AMM pools", () => {
  it("tracks reserves and price, records price points, and buckets swaps into 1-minute candles", async () => {
    const indexer = createTestIndexer();
    const swap = (
      n: number,
      ts: number,
      baseIn: boolean,
      amountIn: bigint,
      amountOut: bigint,
      rb: bigint,
      rq: bigint,
    ) =>
      ({
        contract: "MonetaAMM",
        event: "Swap",
        block: block(n, ts),
        params: {
          poolId: 1n,
          sender: ALICE,
          to: ALICE,
          baseIn,
          amountIn,
          amountOut,
          protocolFee: 0n,
          reserveBase: rb,
          reserveQuote: rq,
        },
      }) as const;
    const E18 = 10n ** 18n;
    await indexer.process({
      chains: {
        [CHAIN]: {
          simulate: [
            {
              contract: "MonetaAMM",
              event: "PoolCreated",
              block: block(30, T0 + 60),
              params: {
                poolId: 1n,
                base: BASE,
                quote: USDC,
                owner: OWNER,
                feeBps: 30n,
                twapStart: BigInt(T0 + 60),
                twapEnd: 2n ** 40n - 1n,
                maxStepPerSecond: 1n,
              },
            },
            {
              contract: "MonetaAMM",
              event: "LiquidityAdded",
              block: block(30, T0 + 60),
              params: {
                poolId: 1n,
                base: 100n * E18,
                quote: usdc(10),
                reserveBase: 100n * E18,
                reserveQuote: usdc(10),
              },
            },
            // two buys in the same minute → one candle; a sell a minute later → a second candle
            swap(31, T0 + 61, false, usdc(1), 9n * E18, 91n * E18, usdc(11)),
            swap(32, T0 + 90, false, usdc(1), 8n * E18, 83n * E18, usdc(12)),
            swap(33, T0 + 125, true, 3n * E18, usdc(0.42), 86n * E18, usdc(11.58)),
            {
              contract: "MonetaAMM",
              event: "ObservationUpdated",
              block: block(33, T0 + 125),
              params: {
                poolId: 1n,
                observation: 12n * 10n ** 28n,
                cumulative: 777n,
                timestamp: BigInt(T0 + 125),
              },
            },
          ],
        },
      },
    } as never);

    const pool = await indexer.Pool.getOrThrow("1");
    expect(pool.reserveBase).toBe(86n * E18);
    expect(pool.reserveQuote).toBe(usdc(11.58));
    expect(pool.swapCount).toBe(3);
    expect(pool.volumeQuote).toBe(usdc(2.42));
    expect(pool.cumulative).toBe(777n);
    // price = quote × 1e36 / base
    expect(pool.price).toBe((usdc(11.58) * 10n ** 36n) / (86n * E18));

    const candles = (await indexer.Candle.getAll()).sort((a, b) =>
      Number(a.bucketStart - b.bucketStart),
    );
    expect(candles.map((c) => c.trades)).toEqual([2, 1]);
    expect(candles[0]!.open).toBe((usdc(10) * 10n ** 36n) / (100n * E18));
    expect(candles[0]!.close).toBe((usdc(12) * 10n ** 36n) / (83n * E18));
    expect(candles[0]!.volumeQuote).toBe(usdc(2));
    expect(candles[1]!.volumeQuote).toBe(usdc(0.42));

    const points = await indexer.PricePoint.getAll();
    expect(points.filter((p) => p.kind === "SPOT")).toHaveLength(3);
    expect(points.filter((p) => p.kind === "OBSERVATION")).toHaveLength(1);
  });
});

import { ActionType, PRICE_SCALE, quoteSwap, spotPrice } from "@moneta/sdk";
import { describe, expect, it } from "vitest";
import { buyToTarget, passProbability, sellToTarget, sqrt, type Scenario } from "../src/market.js";

const scenario: Scenario = {
  rules: [
    { match: "celebrity", bias: "fail", strength: 0.92 },
    { actionType: "TrancheRelease", bias: "pass", strength: 0.8 },
  ],
  tradeSize: { min: 0.05, max: 3 },
  tradeProbability: 0.5,
};
const E18 = 10n ** 18n;
const pool = { reserveBase: 100n * E18, reserveQuote: 10_000_000n, feeBps: 30 }; // 100 tokens / 10 USDC → $0.10
const price = spotPrice(pool.reserveBase, pool.reserveQuote);
const BIG = 10n ** 30n;

describe("passProbability", () => {
  it("applies memo matches before action-type rules, and is neutral otherwise", () => {
    expect(passProbability(scenario, ActionType.TrancheRelease, "Milestone shipped")).toBe(0.8);
    expect(
      passProbability(scenario, ActionType.TrancheRelease, "Pay a CELEBRITY for an endorsement"),
    ).toBeCloseTo(0.08);
    expect(passProbability(scenario, ActionType.SetBudget, "raise the budget")).toBe(0.5);
  });
});

describe("sqrt", () => {
  it("is the integer floor square root", () => {
    for (const n of [0n, 1n, 2n, 3n, 4n, 15n, 16n, 17n, PRICE_SCALE, 10n ** 37n + 12345n]) {
      const r = sqrt(n);
      expect(r * r <= n && (r + 1n) * (r + 1n) > n).toBe(true);
    }
  });
});

describe("trade sizing", () => {
  it("buys just enough to reach the target when uncapped (within the pool fee)", () => {
    const target = (price * 11_000n) / 10_000n; // +10%
    const amount = buyToTarget(pool, target, 10_000n, BIG);
    const q = quoteSwap(pool, false, amount);
    const after = spotPrice(pool.reserveBase - q.amountOut, pool.reserveQuote + amount);
    const missBps = Number(((target - after) * 10_000n) / target);
    expect(missBps).toBeGreaterThanOrEqual(0); // never overshoots
    expect(missBps).toBeLessThan(40); // short only by the 0.3% fee and rounding
  });

  it("sells just enough to reach a lower target", () => {
    const target = (price * 9_000n) / 10_000n; // −10%
    const amount = sellToTarget(pool, target, 10_000n, BIG);
    const q = quoteSwap(pool, true, amount);
    const after = spotPrice(pool.reserveBase + amount, pool.reserveQuote - q.amountOut);
    const missBps = Number(((after - target) * 10_000n) / target);
    expect(missBps).toBeGreaterThanOrEqual(0);
    expect(missBps).toBeLessThan(40);
  });

  it("respects the pool-share cap, the spend cap and holdings", () => {
    const far = price * 10n;
    expect(buyToTarget(pool, far, 150n, BIG)).toBe((pool.reserveQuote * 150n) / 10_000n);
    expect(buyToTarget(pool, far, 150n, 50_000n)).toBe(50_000n);
    expect(sellToTarget(pool, price / 10n, 150n, 7n)).toBe(7n);
  });

  it("does nothing when the price is already on the right side of the target", () => {
    expect(buyToTarget(pool, price, 150n, BIG)).toBe(0n);
    expect(sellToTarget(pool, price, 150n, BIG)).toBe(0n);
    expect(buyToTarget(pool, price / 2n, 150n, BIG)).toBe(0n);
    expect(sellToTarget(pool, price * 2n, 150n, BIG)).toBe(0n);
  });
});

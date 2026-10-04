import { ActionType, PRICE_SCALE, type PoolView } from "@moneta/sdk";

/** Pure market logic for the market-maker bots (unit-tested in test/market.test.ts). */

export type Rule = {
  match?: string;
  actionType?: keyof typeof ActionType;
  bias: "pass" | "fail" | "random";
  strength: number;
};
export type Scenario = {
  rules: Rule[];
  /** Max USDC a single trade spends. */
  tradeSize: { min: number; max: number };
  tradeProbability: number;
  /** Cap each trade at this share of the pool's reserves, so bots never swamp a small market. */
  maxPoolShareBps?: number;
  /** How far apart the bots believe the two worlds are, at full conviction (bps of the opening price). */
  maxEdgeBps?: number;
  /** Per-trader belief noise (bps), so the bots disagree and the markets keep trading. */
  noiseBps?: number;
};

/** Probability the proposal raises token value (0.5 = no view), from the scenario rules. */
export function passProbability(s: Scenario, actionType: number, memo: string): number {
  const name = (Object.keys(ActionType) as (keyof typeof ActionType)[]).find(
    (k) => ActionType[k] === actionType,
  );
  for (const r of s.rules) {
    const hit =
      (r.match && memo.toLowerCase().includes(r.match.toLowerCase())) ||
      (r.actionType && r.actionType === name);
    if (hit) return r.bias === "random" ? 0.5 : r.bias === "pass" ? r.strength : 1 - r.strength;
  }
  return 0.5;
}

export const gauss = () => {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** Integer square root (bigint). */
export function sqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/** Pool price (PRICE_SCALE) → constant-product quote needed to move it to `target`: Q·(√(target/price) − 1). */
export function buyToTarget(
  pool: Pick<PoolView, "reserveBase" | "reserveQuote">,
  target: bigint,
  shareBps: bigint,
  maxSpend: bigint,
): bigint {
  const price = (pool.reserveQuote * PRICE_SCALE) / pool.reserveBase;
  if (target <= price) return 0n;
  const need =
    (pool.reserveQuote * (sqrt((target * PRICE_SCALE) / price) - sqrt(PRICE_SCALE))) /
    sqrt(PRICE_SCALE);
  const cap = (pool.reserveQuote * shareBps) / 10_000n;
  let amount = need < cap ? need : cap;
  if (amount > maxSpend) amount = maxSpend;
  return amount;
}

/** Base tokens to sell to move the price down to `target`: B·(√(price/target) − 1), capped by share and holdings. */
export function sellToTarget(
  pool: Pick<PoolView, "reserveBase" | "reserveQuote">,
  target: bigint,
  shareBps: bigint,
  held: bigint,
): bigint {
  const price = (pool.reserveQuote * PRICE_SCALE) / pool.reserveBase;
  if (target >= price || target === 0n) return 0n;
  const need =
    (pool.reserveBase * (sqrt((price * PRICE_SCALE) / target) - sqrt(PRICE_SCALE))) /
    sqrt(PRICE_SCALE);
  const cap = (pool.reserveBase * shareBps) / 10_000n;
  let amount = need < cap ? need : cap;
  if (amount > held) amount = held;
  return amount;
}

import { BPS, PRICE_SCALE } from "../constants";

/** Exact bigint mirror of CPMath.sol (OpenZeppelin Math.mulDiv semantics). Parity-tested against forge vectors. */

export function mulDiv(a: bigint, b: bigint, d: bigint): bigint {
  return (a * b) / d;
}

export function mulDivUp(a: bigint, b: bigint, d: bigint): bigint {
  const p = a * b;
  return p === 0n ? 0n : (p - 1n) / d + 1n;
}

/** Output for an exact-input swap; fee on input rounded up, output rounded down. */
export function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: bigint,
): { amountOut: bigint; fee: bigint } {
  const fee = mulDivUp(amountIn, feeBps, BPS);
  const inAfterFee = amountIn - fee;
  const amountOut = mulDiv(inAfterFee, reserveOut, reserveIn + inAfterFee);
  return { amountOut, fee };
}

/** Spot price (quote per base, PRICE_SCALE). */
export function spotPrice(reserveBase: bigint, reserveQuote: bigint): bigint {
  if (reserveBase === 0n) return 0n;
  return mulDiv(reserveQuote, PRICE_SCALE, reserveBase);
}

export function ratioMatched(
  baseDesired: bigint,
  quoteDesired: bigint,
  reserveBase: bigint,
  reserveQuote: bigint,
): { baseUsed: bigint; quoteUsed: bigint } {
  const quoteOptimal = mulDiv(baseDesired, reserveQuote, reserveBase);
  if (quoteOptimal <= quoteDesired) return { baseUsed: baseDesired, quoteUsed: quoteOptimal };
  return { baseUsed: mulDiv(quoteDesired, reserveBase, reserveQuote), quoteUsed: quoteDesired };
}

export type Reserves = { reserveBase: bigint; reserveQuote: bigint; feeBps: number | bigint };

export type SwapQuote = {
  amountOut: bigint;
  fee: bigint;
  priceBefore: bigint;
  priceAfter: bigint;
  /** Price impact in bps (always >= 0). */
  priceImpactBps: number;
};

/** Full quote for a swap on a pool (protocol fee share only affects reserves, not the trader's output). */
export function quoteSwap(
  pool: Reserves,
  baseIn: boolean,
  amountIn: bigint,
  protocolFeeShareBps: bigint = 0n,
): SwapQuote {
  const fee = BigInt(pool.feeBps);
  const [rIn, rOut] = baseIn
    ? [pool.reserveBase, pool.reserveQuote]
    : [pool.reserveQuote, pool.reserveBase];
  const priceBefore = spotPrice(pool.reserveBase, pool.reserveQuote);
  if (rIn === 0n || rOut === 0n || amountIn === 0n) {
    return { amountOut: 0n, fee: 0n, priceBefore, priceAfter: priceBefore, priceImpactBps: 0 };
  }
  const q = getAmountOut(amountIn, rIn, rOut, fee);
  const protocolFee = (q.fee * protocolFeeShareBps) / BPS;
  const newIn = rIn + amountIn - protocolFee;
  const newOut = rOut - q.amountOut;
  const priceAfter = baseIn ? spotPrice(newIn, newOut) : spotPrice(newOut, newIn);
  const diff = priceAfter > priceBefore ? priceAfter - priceBefore : priceBefore - priceAfter;
  const priceImpactBps = priceBefore === 0n ? 0 : Number((diff * BPS) / priceBefore);
  return { amountOut: q.amountOut, fee: q.fee, priceBefore, priceAfter, priceImpactBps };
}

/** Minimum output after slippage tolerance (bps). */
export function withSlippage(amountOut: bigint, slippageBps: number): bigint {
  return (amountOut * (BPS - BigInt(slippageBps))) / BPS;
}

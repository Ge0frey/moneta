import { PRICE_SCALE, TOKEN_UNIT } from "../constants";

/**
 * Price units used across Moneta:
 *  - raise price / NAV per token: quote raw units per 1e18 token raw units (e.g. 0.10 USDC = 100_000n)
 *  - AMM prices: quote raw per base raw × 1e36 ("scaled")
 */

/** raisePrice (quote raw per whole token) → AMM scaled price. */
export function raisePriceToScaled(price: bigint): bigint {
  return (price * PRICE_SCALE) / TOKEN_UNIT;
}

/** AMM scaled price → quote raw units per whole 18-decimal token (same unit as raisePrice). */
export function scaledToTokenPrice(scaled: bigint, baseDecimals = 18): bigint {
  return (scaled * 10n ** BigInt(baseDecimals)) / PRICE_SCALE;
}

/** AMM scaled price → JS number of quote whole units per whole base unit (display only). */
export function scaledToNumber(scaled: bigint, baseDecimals = 18, quoteDecimals = 6): number {
  const perWhole = scaledToTokenPrice(scaled, baseDecimals); // quote raw per whole token
  return Number(perWhole) / 10 ** quoteDecimals;
}

/** Tokens bought for `quoteAmount` at a fixed raise price. */
export function tokensForQuote(quoteAmount: bigint, price: bigint): bigint {
  return (quoteAmount * TOKEN_UNIT) / price;
}

/** Fully diluted value (quote raw) for a supply at a raise-unit price. */
export function fdv(supply: bigint, price: bigint): bigint {
  return (supply * price) / TOKEN_UNIT;
}

import { PRICE_SCALE } from "./constants";

/**
 * Display formatting: USDC 2 decimals, compact token amounts, signed 1-decimal percentages,
 * subscript zeros for tiny prices, tabular-friendly output. Pure functions on bigint — no float drift on amounts.
 */

const SUBSCRIPTS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

function groupThousands(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Exact decimal string of `value / 10^decimals`, truncated to `maxFrac` digits, trailing zeros trimmed to `minFrac`. */
export function toDecimalString(
  value: bigint,
  decimals: number,
  maxFrac = decimals,
  minFrac = 0,
): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const int = abs / base;
  let frac = (abs % base).toString().padStart(decimals, "0").slice(0, maxFrac);
  while (frac.length > minFrac && frac.endsWith("0")) frac = frac.slice(0, -1);
  return `${neg ? "-" : ""}${groupThousands(int.toString())}${frac ? `.${frac}` : ""}`;
}

function compact(n: number): string {
  const abs = Math.abs(n);
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [v, s] of units) {
    if (abs >= v) return `${(n / v).toFixed(abs / v >= 100 ? 0 : 1).replace(/\.0$/, "")}${s}`;
  }
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** "$1,240.50" — or compact "$1.2M" when `compact` is set and the value is ≥ 10,000. */
export function formatUsd(
  raw: bigint,
  decimals = 6,
  opts: { compact?: boolean; minFrac?: number } = {},
): string {
  const asNumber = Number(raw) / 10 ** decimals;
  if (opts.compact && Math.abs(asNumber) >= 10_000) return `$${compact(asNumber)}`;
  const s = toDecimalString(raw, decimals, 2, opts.minFrac ?? 2);
  return s.startsWith("-") ? `-$${s.slice(1)}` : `$${s}`;
}

/** Token amount: compact above 10k ("12.4M"), else up to 4 significant decimals. */
export function formatToken(raw: bigint, decimals = 18, symbol?: string): string {
  const n = Number(raw) / 10 ** decimals;
  const body = Math.abs(n) >= 10_000 ? compact(n) : toDecimalString(raw, decimals, n >= 1 ? 2 : 4);
  return symbol ? `${body} ${symbol}` : body;
}

/** Format a plain JS price number with subscript zeros for tiny values: 0.0000123 → "0.0₄123". */
export function formatPriceNumber(price: number, sig = 4): string {
  if (!Number.isFinite(price) || price === 0) return "0";
  if (price >= 1)
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const s = price.toFixed(18);
  const m = s.match(/^0\.(0*)(\d+)/);
  if (!m) return s;
  const zeros = m[1]!.length;
  const digits = m[2]!.slice(0, sig).replace(/0+$/, "") || "0";
  if (zeros < 4) return `0.${"0".repeat(zeros)}${digits}`;
  const sub = String(zeros)
    .split("")
    .map((d) => SUBSCRIPTS[Number(d)])
    .join("");
  return `0.0${sub}${digits}`;
}

/** AMM scaled price → "$0.1180". */
export function formatScaledPrice(scaled: bigint, baseDecimals = 18, quoteDecimals = 6): string {
  const perWhole = (scaled * 10n ** BigInt(baseDecimals)) / PRICE_SCALE;
  const n = Number(perWhole) / 10 ** quoteDecimals;
  return `$${formatPriceNumber(n)}`;
}

/** Raise-unit price (quote raw per whole token) → "$0.10". */
export function formatTokenPrice(price: bigint, quoteDecimals = 6): string {
  return `$${formatPriceNumber(Number(price) / 10 ** quoteDecimals)}`;
}

/** Basis points → "13.5%" (signed: "+13.5%"). */
export function formatBps(bps: number, opts: { signed?: boolean; digits?: number } = {}): string {
  const pct = bps / 100;
  const s = pct.toFixed(opts.digits ?? 1);
  return `${opts.signed && pct > 0 ? "+" : ""}${s}%`;
}

export function shortAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, 2 + chars)}…${addr.slice(-chars)}`;
}

/** Seconds → "3d 4h", "2m 41s", "45s". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/** Seconds → "02:41" or "1d 03:12:09" (countdowns; tabular). */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86_400);
  const hh = String(Math.floor((s % 86_400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  if (d > 0) return `${d}d ${hh}:${mm}:${ss}`;
  if (hh !== "00") return `${hh}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

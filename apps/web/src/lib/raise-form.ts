import { formatBps, formatDuration, type Bounds, type GovConfig } from "@moneta/sdk";
import { isAddress, parseUnits, type Address } from "viem";
import { fromCfgInput, toCfgInput, type CfgInput } from "./gov-config";

/**
 * Create-raise wizard logic, kept free of React so it can be unit-tested against the contract rules
 * (MonetaFactory._validate) and the launch math (Raise.finalize + Treasury.launch).
 */

export const STEPS = ["Project", "Terms", "Treasury Plan", "Memo", "Review & Publish"] as const;
export const UNIT_SECONDS = { min: 60, hour: 3600, day: 86_400 } as const;
export type Unit = keyof typeof UNIT_SECONDS;

export type Draft = {
  name: string;
  symbol: string;
  founder: string;
  price: string;
  min: string;
  max: string;
  window: string;
  windowUnit: Unit;
  liquidityPct: string;
  budget: string;
  tranches: string[];
  perf: { multiple: string; amount: string }[];
  perfCliff: string;
  perfCliffUnit: Unit;
  perfWindow: string;
  perfWindowUnit: Unit;
  gov: CfgInput;
};

/** Fast governance on local/testnet (minute-scale windows), production-grade values otherwise; clamped to bounds. */
export function defaultGov(b: Bounds): GovConfig {
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  const fast = b.minDuration <= 300;
  return {
    thetaTrancheBps: clamp(0, b.minTheta, b.maxTheta),
    thetaTeamBps: clamp(100, b.minTheta, b.maxTheta),
    thetaCommunityBps: clamp(300, b.minTheta, b.maxTheta),
    proposalLiquidityBps: clamp(5000, b.minProposalLiquidityBps, b.maxProposalLiquidityBps),
    maxStepBps: clamp(fast ? 100 : 2, b.minMaxStepBps, b.maxMaxStepBps),
    warmup: clamp(fast ? 30 : 86_400, b.minWarmup, b.maxWarmup),
    duration: clamp(fast ? 180 : 3 * 86_400, b.minDuration, b.maxDuration),
    executionGrace: Math.max(fast ? 600 : 7 * 86_400, b.minExecutionGrace),
    bond: fast
      ? 1_000_000n > b.minBond
        ? 1_000_000n
        : b.minBond
      : 500_000_000n > b.minBond
        ? 500_000_000n
        : b.minBond,
  };
}

export function initialDraft(b: Bounds): Draft {
  const fast = b.minRaiseWindow <= 600;
  return {
    name: "",
    symbol: "",
    founder: "",
    price: "0.10",
    min: fast ? "40" : "50000",
    max: fast ? "200" : "250000",
    window: fast ? "10" : "4",
    windowUnit: fast ? "min" : "day",
    liquidityPct: "20",
    budget: fast ? "30" : "15000",
    tranches: ["25", "25", "25", "20"],
    perf: [],
    perfCliff: fast ? "5" : "540",
    perfCliffUnit: fast ? "min" : "day",
    perfWindow: fast ? "2" : "30",
    perfWindowUnit: fast ? "min" : "day",
    gov: toCfgInput(defaultGov(b)),
  };
}

export function usdc(v: string): bigint | undefined {
  try {
    return v.trim() ? parseUnits(v.trim(), 6) : undefined;
  } catch {
    return undefined;
  }
}
export function tokens(v: string): bigint | undefined {
  try {
    return v.trim() ? parseUnits(v.trim(), 18) : undefined;
  } catch {
    return undefined;
  }
}
export function pctToBps(v: string): number | undefined {
  const n = Number(v);
  if (!v.trim() || !Number.isFinite(n)) return undefined;
  return Math.round(n * 100);
}
export const byteLen = (s: string) => new TextEncoder().encode(s).length;

/** Every check Factory._validate makes, keyed by step so the wizard can block "Continue" on the right fields. */
export function validate(d: Draft, b: Bounds) {
  const e: Record<string, string> = {};
  // 1 · project
  if (!d.name.trim()) e.name = "Name your project";
  else if (byteLen(d.name) > 32) e.name = "32 bytes at most";
  if (!d.symbol) e.symbol = "Pick a ticker";
  else if (byteLen(d.symbol) > 11) e.symbol = "11 characters at most";
  else if (!/^[A-Z0-9]+$/.test(d.symbol)) e.symbol = "Capital letters and digits only";
  if (!isAddress(d.founder)) e.founder = "Enter the founder address (a Safe is recommended)";
  else if (/^0x0{40}$/i.test(d.founder)) e.founder = "Can't be the zero address";
  // 2 · terms
  const price = usdc(d.price);
  const min = usdc(d.min);
  const max = usdc(d.max);
  if (!price) e.price = "Price per token, above zero";
  if (!min) e.min = "Minimum raise, above zero";
  if (!max) e.max = "Maximum raise";
  else if (min && max < min) e.max = "Must be at least the minimum";
  if (price && min && (min * 10n ** 18n) / price === 0n) e.price = "Too high for this minimum";
  const windowSec = Math.round(Number(d.window) * UNIT_SECONDS[d.windowUnit]);
  if (!Number.isFinite(windowSec) || windowSec <= 0) e.window = "Enter a duration";
  else if (windowSec < b.minRaiseWindow || windowSec > b.maxRaiseWindow)
    e.window = `Between ${formatDuration(b.minRaiseWindow)} and ${formatDuration(b.maxRaiseWindow)}`;
  const liq = pctToBps(d.liquidityPct);
  if (liq === undefined || liq < b.minLiquidityBps || liq > b.maxLiquidityBps)
    e.liquidity = `Between ${formatBps(b.minLiquidityBps, { digits: 0 })} and ${formatBps(b.maxLiquidityBps, { digits: 0 })}`;
  // 3 · treasury plan
  const budget = d.budget.trim() === "0" ? 0n : usdc(d.budget);
  if (budget === undefined) e.budget = "Monthly budget in USDC (0 for none)";
  const trancheBps = d.tranches.map(pctToBps);
  if (d.tranches.length > b.maxTranches) e.tranches = `At most ${b.maxTranches} tranches`;
  trancheBps.forEach((t, i) => {
    if (t === undefined || t <= 0) e[`tranche${i}`] = "Above 0%";
  });
  const trancheSum = trancheBps.reduce<number>((a, t) => a + (t ?? 0), 0);
  if (trancheSum > 10_000)
    e.tranches = `Tranches add up to ${formatBps(trancheSum)}; the most is 100%`;
  const perfCliff = Math.round(Number(d.perfCliff) * UNIT_SECONDS[d.perfCliffUnit]);
  const perfWindow = Math.round(Number(d.perfWindow) * UNIT_SECONDS[d.perfWindowUnit]);
  if (d.perf.length > b.maxPerfTranches)
    e.perf = `At most ${b.maxPerfTranches} performance tranches`;
  let prev = 99;
  const perf = d.perf.map((p, i) => {
    const m = Math.round(Number(p.multiple) * 100);
    const amt = tokens(p.amount);
    if (!Number.isFinite(m) || m <= prev)
      e[`perfm${i}`] = i === 0 ? "At least 1×" : "Must rise with each tranche";
    else prev = m;
    if (!amt) e[`perfa${i}`] = "Token amount above zero";
    return { multipleX100: m, amount: amt ?? 0n };
  });
  if (d.perf.length && (!Number.isFinite(perfWindow) || perfWindow <= 0))
    e.perfWindow = "Unlock window above zero";
  if (d.perf.length && (!Number.isFinite(perfCliff) || perfCliff < 0))
    e.perfCliff = "Cliff of zero or more";
  const gov = fromCfgInput(d.gov, b);
  for (const [k, v] of Object.entries(gov.errors)) e[`gov.${k}`] = v;

  const params =
    Object.keys(e).length === 0
      ? {
          name: d.name.trim(),
          symbol: d.symbol,
          founder: d.founder as Address,
          price: price!,
          minRaise: min!,
          maxRaise: max!,
          windowSec,
          liquidityBps: liq!,
          budgetPerMonth: budget!,
          trancheBps: trancheBps as number[],
          perf,
          perfCliff: d.perf.length ? perfCliff : 0,
          perfUnlockWindow: d.perf.length ? perfWindow : 0,
          gov: gov.config!,
        }
      : undefined;
  return { errors: e, params, price, min, max, liq, budget, trancheBps, windowSec };
}

export const STEP_FIELDS: ((k: string) => boolean)[] = [
  (k) => ["name", "symbol", "founder"].includes(k),
  (k) => ["price", "min", "max", "window", "liquidity"].includes(k),
  (k) => k === "budget" || k.startsWith("tranche") || k.startsWith("perf") || k.startsWith("gov."),
  (k) => k === "memo",
  () => false,
];

/** Mirrors Raise.finalize + Treasury.launch: what the raise turns into at a given total. */
export function launchAt(
  total: bigint,
  price: bigint,
  max: bigint,
  liqBps: number,
  feeBps: number,
  trancheBps: number[],
) {
  const accepted = total < max ? total : max;
  const fee = (accepted * BigInt(feeBps)) / 10_000n;
  const net = accepted - fee;
  const contributorTokens = (accepted * 10n ** 18n) / price;
  const liquidityQuote = (net * BigInt(liqBps)) / 10_000n;
  const liquidityTokens = (liquidityQuote * 10n ** 18n) / price;
  const treasury = net - liquidityQuote;
  const supply = contributorTokens + liquidityTokens;
  return {
    accepted,
    fee,
    contributorTokens,
    liquidityQuote,
    liquidityTokens,
    treasury,
    supply,
    fdv: (supply * price) / 10n ** 18n,
    tranches: trancheBps.map((b) => (treasury * BigInt(b)) / 10_000n),
  };
}

export function memoTemplate(d: Draft): string {
  const rows = d.tranches
    .map((t, i) => `| ${i + 1} | What ships before this unlocks | ${t}% |`)
    .join("\n");
  return `# ${d.name || "Project"}\n\n## Thesis\n\nWhat you're building, for whom, and why now.\n\n## Team\n\nWho is building it and what they've shipped before.\n\n## Milestones\n\n| Tranche | Deliverable | Share of treasury |\n|---|---|---|\n${rows}\n\n## Use of funds\n\nHow the streamed budget and each tranche will be spent.\n`;
}

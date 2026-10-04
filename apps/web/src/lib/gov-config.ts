import { formatBps, formatUsd, type Bounds, type GovConfig } from "@moneta/sdk";
import { parseUnits } from "viem";

/** Governance config form helpers (mirror Validation.validateGov), shared by the wizard and the proposal composer. */

function parseUsdc(v: string): bigint | undefined {
  try {
    return parseUnits(v.trim(), 6);
  } catch {
    return undefined;
  }
}

export function thresholdCopy(theta: number): string {
  if (theta === 0) return "PASS ≥ FAIL";
  return theta > 0
    ? `PASS beats FAIL by ${formatBps(theta)}`
    : `PASS within ${formatBps(-theta)} of FAIL`;
}

export type CfgInput = Record<keyof GovConfig, string>;

export function toCfgInput(g: GovConfig): CfgInput {
  return {
    thetaTrancheBps: String(g.thetaTrancheBps),
    thetaTeamBps: String(g.thetaTeamBps),
    thetaCommunityBps: String(g.thetaCommunityBps),
    proposalLiquidityBps: String(g.proposalLiquidityBps),
    maxStepBps: String(g.maxStepBps),
    warmup: String(g.warmup),
    duration: String(g.duration),
    executionGrace: String(g.executionGrace),
    bond: (Number(g.bond) / 1e6).toString(),
  };
}

/** Parse + validate against the factory's on-chain bounds (mirrors Validation.validateGov). */
export function fromCfgInput(
  c: CfgInput,
  b: Bounds,
): { config?: GovConfig; errors: Record<string, string> } {
  const e: Record<string, string> = {};
  const int = (k: keyof GovConfig, min: number, max: number) => {
    const v = Number(c[k]);
    if (!/^-?\d+$/.test(c[k].trim())) e[k] = "Whole number";
    else if (v < min || v > max)
      e[k] = `Between ${min.toLocaleString()} and ${max.toLocaleString()}`;
    return v;
  };
  const config: GovConfig = {
    thetaTrancheBps: int("thetaTrancheBps", b.minTheta, b.maxTheta),
    thetaTeamBps: int("thetaTeamBps", b.minTheta, b.maxTheta),
    thetaCommunityBps: int("thetaCommunityBps", b.minTheta, b.maxTheta),
    proposalLiquidityBps: int(
      "proposalLiquidityBps",
      b.minProposalLiquidityBps,
      b.maxProposalLiquidityBps,
    ),
    maxStepBps: int("maxStepBps", b.minMaxStepBps, b.maxMaxStepBps),
    warmup: int("warmup", b.minWarmup, b.maxWarmup),
    duration: int("duration", b.minDuration, b.maxDuration),
    executionGrace: int("executionGrace", b.minExecutionGrace, 2 ** 40 - 1),
    bond: 0n,
  };
  const bond = parseUsdc(c.bond || "0");
  if (bond === undefined) e.bond = "Not a valid amount";
  else if (bond < b.minBond) e.bond = `At least ${formatUsd(b.minBond)}`;
  else config.bond = bond;
  return Object.keys(e).length ? { errors: e } : { config, errors: e };
}

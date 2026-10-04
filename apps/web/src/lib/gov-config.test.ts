import type { Bounds } from "@moneta/sdk";
import { describe, expect, it } from "vitest";
import { fromCfgInput, thresholdCopy, toCfgInput } from "./gov-config";

const b = {
  minTheta: -500,
  maxTheta: 2000,
  minWarmup: 0,
  maxWarmup: 604_800,
  minDuration: 60,
  maxDuration: 1_209_600,
  minProposalLiquidityBps: 1000,
  maxProposalLiquidityBps: 9000,
  minMaxStepBps: 1,
  maxMaxStepBps: 1000,
  minExecutionGrace: 60,
  minBond: 1_000_000n,
} as Bounds;
const g = {
  thetaTrancheBps: 0,
  thetaTeamBps: 100,
  thetaCommunityBps: 300,
  proposalLiquidityBps: 5000,
  maxStepBps: 100,
  warmup: 30,
  duration: 180,
  executionGrace: 600,
  bond: 1_000_000n,
};

describe("governance config form (mirrors Validation.validateGov)", () => {
  it("round-trips a valid config", () => {
    expect(fromCfgInput(toCfgInput(g), b)).toEqual({ config: g, errors: {} });
  });
  it("rejects out-of-bounds values field by field", () => {
    const r = fromCfgInput(
      { ...toCfgInput(g), thetaTeamBps: "-600", maxStepBps: "0", bond: "0.5" },
      b,
    );
    expect(r.config).toBeUndefined();
    expect(Object.keys(r.errors).sort()).toEqual(["bond", "maxStepBps", "thetaTeamBps"]);
  });
  it("describes thresholds in words", () => {
    expect(thresholdCopy(0)).toBe("PASS ≥ FAIL");
    expect(thresholdCopy(300)).toBe("PASS beats FAIL by 3.0%");
    expect(thresholdCopy(-200)).toBe("PASS within 2.0% of FAIL");
  });
});

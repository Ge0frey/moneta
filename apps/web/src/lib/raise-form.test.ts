import type { Bounds } from "@moneta/sdk";
import { describe, expect, it } from "vitest";
import { initialDraft, launchAt, validate, type Draft } from "./raise-form";

/** Testnet bounds as deployed (see /status). */
const B: Bounds = {
  minRaiseWindow: 60,
  maxRaiseWindow: 30 * 86_400,
  maxStartDelay: 7 * 86_400,
  finalizeGrace: 600,
  minLiquidityBps: 500,
  maxLiquidityBps: 5000,
  maxTranches: 8,
  maxPerfTranches: 5,
  minWarmup: 0,
  maxWarmup: 7 * 86_400,
  minDuration: 60,
  maxDuration: 14 * 86_400,
  minProposalLiquidityBps: 1000,
  maxProposalLiquidityBps: 9000,
  minMaxStepBps: 1,
  maxMaxStepBps: 1000,
  minTheta: -500,
  maxTheta: 2000,
  minBond: 0n,
  minExecutionGrace: 60,
  maxMintBps: 2000,
  maxMemoBytes: 16_384,
};
const FOUNDER = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
const ok = (): Draft => ({
  ...initialDraft(B),
  name: "Lumen Labs",
  symbol: "LUM",
  founder: FOUNDER,
});
const errorsOf = (patch: Partial<Draft>) => validate({ ...ok(), ...patch }, B).errors;

describe("raise wizard validation (mirrors MonetaFactory._validate)", () => {
  it("accepts the default terms once the project is named", () => {
    const v = validate(ok(), B);
    expect(v.errors).toEqual({});
    expect(v.params).toMatchObject({
      name: "Lumen Labs",
      symbol: "LUM",
      price: 100_000n,
      liquidityBps: 2000,
      windowSec: 600,
    });
    expect(v.params!.trancheBps).toEqual([2500, 2500, 2500, 2000]);
  });

  it("enforces name and ticker byte limits and the ticker alphabet", () => {
    expect(errorsOf({ name: "x".repeat(33) }).name).toBeDefined();
    expect(errorsOf({ symbol: "TWELVECHARSX" }).symbol).toBeDefined();
    expect(errorsOf({ symbol: "lum" }).symbol).toBeDefined();
    expect(
      errorsOf({ founder: "0x0000000000000000000000000000000000000000" }).founder,
    ).toBeDefined();
  });

  it("checks the raise range and a price that would mint zero tokens at the minimum", () => {
    expect(errorsOf({ min: "100", max: "50" }).max).toBeDefined();
    expect(errorsOf({ min: "0.000001", price: "2000000000000" }).price).toBeDefined(); // 1 raw unit buys 0 tokens
  });

  it("checks the window and liquidity share against the factory bounds", () => {
    expect(errorsOf({ window: "30", windowUnit: "min" }).window).toBeUndefined();
    expect(errorsOf({ window: "0.5", windowUnit: "min" }).window).toBeDefined();
    expect(errorsOf({ window: "31", windowUnit: "day" }).window).toBeDefined();
    expect(errorsOf({ liquidityPct: "4" }).liquidity).toBeDefined();
    expect(errorsOf({ liquidityPct: "51" }).liquidity).toBeDefined();
  });

  it("caps tranches at 100% of the treasury and rejects empty ones", () => {
    expect(errorsOf({ tranches: ["60", "50"] }).tranches).toBeDefined();
    expect(errorsOf({ tranches: ["50", "0"] }).tranche1).toBeDefined();
    expect(errorsOf({ tranches: Array(9).fill("5") }).tranches).toBeDefined();
  });

  it("requires strictly rising performance multiples of at least 1x and an unlock window", () => {
    expect(
      errorsOf({
        perf: [
          { multiple: "2", amount: "100" },
          { multiple: "4", amount: "100" },
        ],
      }),
    ).toEqual({});
    expect(errorsOf({ perf: [{ multiple: "1", amount: "100" }] })).toEqual({}); // contract: multipleX100 > 99
    expect(errorsOf({ perf: [{ multiple: "0.9", amount: "100" }] }).perfm0).toBeDefined();
    expect(
      errorsOf({
        perf: [
          { multiple: "4", amount: "100" },
          { multiple: "2", amount: "100" },
        ],
      }).perfm1,
    ).toBeDefined();
    expect(errorsOf({ perf: [{ multiple: "2", amount: "" }] }).perfa0).toBeDefined();
    expect(
      errorsOf({ perf: [{ multiple: "2", amount: "1" }], perfWindow: "0" }).perfWindow,
    ).toBeDefined();
  });

  it("validates governance settings against the bounds", () => {
    const d = ok();
    expect(
      errorsOf({ gov: { ...d.gov, thetaCommunityBps: "2500" } })["gov.thetaCommunityBps"],
    ).toBeDefined();
    expect(errorsOf({ gov: { ...d.gov, duration: "30" } })["gov.duration"]).toBeDefined();
    expect(errorsOf({ gov: { ...d.gov, warmup: "abc" } })["gov.warmup"]).toBeDefined();
  });
});

describe("launch preview (mirrors Raise.finalize + Treasury.launch)", () => {
  const price = 100_000n; // $0.10
  it("splits an at-minimum raise into fee, liquidity, treasury and tranches", () => {
    const x = launchAt(100_000_000n, price, 200_000_000n, 2000, 100, [2500, 2500]);
    expect(x.accepted).toBe(100_000_000n);
    expect(x.fee).toBe(1_000_000n);
    expect(x.contributorTokens).toBe(1000n * 10n ** 18n);
    expect(x.liquidityQuote).toBe(19_800_000n); // 20% of net 99
    expect(x.liquidityTokens).toBe(198n * 10n ** 18n); // paired at the raise price
    expect(x.treasury).toBe(79_200_000n);
    expect(x.tranches).toEqual([19_800_000n, 19_800_000n]);
    expect(x.fdv).toBe(119_800_000n);
  });

  it("caps an oversubscribed raise at the maximum", () => {
    const x = launchAt(300_000_000n, price, 200_000_000n, 2000, 100, []);
    expect(x.accepted).toBe(200_000_000n);
    expect(x.contributorTokens).toBe(2000n * 10n ** 18n);
  });
});

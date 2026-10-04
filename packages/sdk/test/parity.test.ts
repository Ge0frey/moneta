import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAmountOut, spotPrice } from "../src/math/cpmath";
import { integral, observationAt } from "../src/math/oracle";

/** Bit-for-bit parity with the Solidity libraries (vectors written by contracts/test/vectors/Vectors.t.sol). */
const load = (f: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, "vectors", f), "utf8")) as Record<
    string,
    string
  >[];

describe("CPMath parity", () => {
  const vectors = load("cpmath.json");
  it("has vectors", () => expect(vectors.length).toBeGreaterThanOrEqual(40));
  it.each(vectors.map((v, i) => [i, v] as const))("vector %i", (_, v) => {
    const { amountOut, fee } = getAmountOut(
      BigInt(v.amountIn!),
      BigInt(v.reserveIn!),
      BigInt(v.reserveOut!),
      BigInt(v.feeBps!),
    );
    expect(amountOut).toBe(BigInt(v.amountOut!));
    expect(fee).toBe(BigInt(v.fee!));
    expect(spotPrice(BigInt(v.reserveIn!), BigInt(v.reserveOut!))).toBe(BigInt(v.spotPrice!));
  });
});

describe("LaggingOracle parity", () => {
  const vectors = load("oracle.json");
  it.each(vectors.map((v, i) => [i, v] as const))("vector %i", (_, v) => {
    const obs = BigInt(v.obs!);
    const spot = BigInt(v.spot!);
    const rate = BigInt(v.rate!);
    expect(integral(obs, spot, rate, BigInt(v.u1!), BigInt(v.u2!))).toBe(BigInt(v.integral!));
    expect(observationAt(obs, spot, rate, BigInt(v.elapsed!))).toBe(BigInt(v.observationAt!));
  });
});

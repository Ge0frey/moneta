import {
  encodeErrorResult,
  getAddress,
  stringToHex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { describe, expect, it } from "vitest";
import { actionTitle, decodeAction, encodeAction, type ProposalAction } from "../src/actions";
import { ActionType, PRICE_SCALE } from "../src/constants";
import { decodeRevertData, MONETA_ERRORS_ABI } from "../src/errors";
import {
  formatBps,
  formatCountdown,
  formatDuration,
  formatPriceNumber,
  formatToken,
  formatUsd,
  shortAddress,
} from "../src/format";
import { quoteSwap, withSlippage } from "../src/math/cpmath";
import { passes, projectVerdict, type PoolOracleView } from "../src/math/oracle";
import { raisePriceToScaled, scaledToNumber, tokensForQuote } from "../src/math/units";
import { PERMIT_TTL_SECONDS, signPermit } from "../src/permit";

const A = getAddress("0x00000000000000000000000000000000000000aa");
const B = getAddress("0x00000000000000000000000000000000000000bb");

describe("action codec", () => {
  const cases: ProposalAction[] = [
    { type: "TrancheRelease", index: 2 },
    { type: "Transfer", token: A, to: B, amount: 123n },
    { type: "SetBudget", perMonth: 40_000_000n },
    { type: "Mint", to: A, amount: 10n ** 21n },
    { type: "Buyback", quoteIn: 5n, minOut: 1n },
    {
      type: "UpdateConfig",
      config: {
        thetaTrancheBps: 0,
        thetaTeamBps: -100,
        thetaCommunityBps: 300,
        proposalLiquidityBps: 5000,
        maxStepBps: 100,
        warmup: 30,
        duration: 180,
        executionGrace: 600,
        bond: 1_000_000n,
      },
    },
    { type: "SetFounder", founder: B },
    { type: "Call", target: A, data: "0xdeadbeef" },
    { type: "Redeem" },
  ];
  it.each(cases.map((c) => [c.type, c] as const))("round-trips %s", (_, c) => {
    const { actionType, data } = encodeAction(c);
    expect(actionType).toBe(ActionType[c.type]);
    const decoded = decodeAction(actionType, data);
    expect(decoded).toEqual(c);
    expect(actionTitle(decoded).length).toBeGreaterThan(3);
  });
  it("encodes tranche index like abi.encode(uint8)", () => {
    expect(encodeAction({ type: "TrancheRelease", index: 1 }).data).toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000001",
    );
  });
});

describe("error decoding", () => {
  it("decodes InvalidAction codes", () => {
    const data = encodeErrorResult({
      abi: MONETA_ERRORS_ABI,
      errorName: "InvalidAction",
      args: [3],
    });
    expect(decodeRevertData(data).message).toMatch(/already released/);
  });
  it("decodes InvalidParam field names", () => {
    const data = encodeErrorResult({
      abi: MONETA_ERRORS_ABI,
      errorName: "InvalidParam",
      args: [stringToHex("window", { size: 32 })],
    });
    expect(decodeRevertData(data).message).toMatch(/Raise window/);
  });
  it("decodes slot errors", () => {
    const data = encodeErrorResult({ abi: MONETA_ERRORS_ABI, errorName: "SlotBusy" });
    const d = decodeRevertData(data);
    expect(d.name).toBe("SlotBusy");
    expect(d.message).toMatch(/Another proposal is live/);
  });
});

describe("units & quotes", () => {
  it("converts raise price ⇄ scaled price", () => {
    const scaled = raisePriceToScaled(100_000n); // 0.10 USDC
    expect(scaled).toBe((100_000n * PRICE_SCALE) / 10n ** 18n);
    expect(scaledToNumber(scaled)).toBeCloseTo(0.1, 10);
    expect(tokensForQuote(1_000_000_000n, 100_000n)).toBe(10_000n * 10n ** 18n);
  });
  it("quotes swaps with impact and slippage", () => {
    const pool = {
      reserveBase: 1_000_000n * 10n ** 18n,
      reserveQuote: 100_000n * 10n ** 6n,
      feeBps: 30,
    };
    const q = quoteSwap(pool, false, 10_000n * 10n ** 6n);
    expect(q.amountOut).toBeGreaterThan(0n);
    expect(q.priceAfter).toBeGreaterThan(q.priceBefore);
    expect(q.priceImpactBps).toBeGreaterThan(1500);
    expect(withSlippage(1000n, 100)).toBe(990n);
  });
});

describe("verdict projection", () => {
  const pool = (obs: bigint, reserveQuote: bigint): PoolOracleView => ({
    observation: obs,
    cumulative: 0n,
    maxStepPerSecond: obs / 100n,
    lastUpdate: 100n,
    twapStart: 100n,
    twapEnd: 300n,
    reserveBase: 1000n * 10n ** 18n,
    reserveQuote,
  });
  it("matches the contract threshold rule", () => {
    expect(passes(100n, 100n, 0)).toBe(true);
    expect(passes(100n, 100n, 300)).toBe(false);
    expect(passes(104n, 100n, 300)).toBe(true);
    expect(passes(98n, 100n, -300)).toBe(true);
  });
  it("projects PASS when the pass pool trades higher", () => {
    const start = raisePriceToScaled(100_000n);
    const pass = pool(start, 150n * 10n ** 6n);
    const fail = pool(start, 100n * 10n ** 6n);
    const v = projectVerdict(pass, fail, 200n, 0);
    expect(v.passing).toBe(true);
    expect(v.premiumBps).toBeGreaterThan(0);
  });
});

describe("format", () => {
  it("formats money and tokens", () => {
    expect(formatUsd(1_240_500_000n)).toBe("$1,240.50");
    expect(formatUsd(12_400_000_000_000n, 6, { compact: true })).toBe("$12.4M");
    expect(formatToken(12_400_000n * 10n ** 18n, 18, "LUM")).toBe("12.4M LUM");
    expect(formatToken(15n * 10n ** 17n)).toBe("1.5");
  });
  it("formats prices, bps, time", () => {
    expect(formatPriceNumber(0.1)).toBe("0.1");
    expect(formatPriceNumber(0.0000123)).toBe("0.0₄123");
    expect(formatBps(1350, { signed: true })).toBe("+13.5%");
    expect(formatBps(-200, { signed: true })).toBe("-2.0%");
    expect(formatDuration(161)).toBe("2m 41s");
    expect(formatCountdown(161)).toBe("02:41");
    expect(formatCountdown(90_061)).toBe("1d 01:01:01");
    expect(shortAddress("0x534b2f3A21130d7a60830c2Df862319e593943A3")).toBe("0x534b…43A3");
  });
});

describe("permit", () => {
  it("takes its deadline from chain time, never the signer's clock", async () => {
    const chainTs = BigInt(Math.floor(Date.now() / 1000)) + 86_400n; // chain a day ahead of this machine
    const publicClient = {
      getChainId: async () => 31337,
      getBlock: async () => ({ timestamp: chainTs }),
      readContract: async ({ functionName }: { functionName: string }) => {
        if (functionName === "eip712Domain")
          return ["0x0f", "MonetaUSDC", "2", 31337n, "0x0", "0x0", []];
        if (functionName === "nonces") return 0n;
        throw new Error(functionName);
      },
    } as unknown as PublicClient;
    let signed: { message: { deadline: bigint } } | undefined;
    const walletClient = {
      signTypedData: async (td: { message: { deadline: bigint } }) => {
        signed = td;
        return `0x${"11".repeat(32)}${"22".repeat(32)}1b`;
      },
    } as unknown as WalletClient;
    const p = await signPermit({
      publicClient,
      walletClient,
      account: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
      token: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      spender: "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
      value: 1_000_000n,
    });
    expect(p.deadline).toBe(chainTs + PERMIT_TTL_SECONDS);
    expect(signed?.message.deadline).toBe(chainTs + PERMIT_TTL_SECONDS);
    expect(p.enabled).toBe(true);
    expect(p.v).toBe(27);
  });
});

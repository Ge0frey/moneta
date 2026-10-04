import type { Protocol } from "envio";

export const PRICE_SCALE = 10n ** 36n;
export const PROTOCOL_ID = "moneta";
export const ZERO = "0x0000000000000000000000000000000000000000";

export const lower = (a: string) => a.toLowerCase();

/** Unique, ordered id for an event: block-logIndex. */
export const eventId = (e: { block: { number: number }; logIndex: number }) =>
  `${e.block.number}-${e.logIndex}`;

export const spot = (reserveBase: bigint, reserveQuote: bigint) =>
  reserveBase === 0n ? 0n : (reserveQuote * PRICE_SCALE) / reserveBase;

export const RAISE_STATUS = ["OPEN", "FAILED", "SUCCEEDED"] as const;

export const proposalKey = (treasury: string, id: bigint) => `${lower(treasury)}-${id.toString()}`;

export const emptyProtocol = (): Protocol => ({
  id: PROTOCOL_ID,
  raiseCount: 0,
  projectCount: 0,
  failedRaiseCount: 0,
  totalRaised: 0n,
  proposalCount: 0,
  verdictsPassed: 0,
  verdictsFailed: 0,
  redeemedCount: 0,
  volumeQuote: 0n,
  updatedAt: 0n,
});

type Ctx = {
  Protocol: {
    get: (id: string) => Promise<Protocol | undefined>;
    set: (p: Protocol) => void;
  };
};

/** Read-modify-write the protocol singleton. */
export async function bumpProtocol(
  context: Ctx,
  ts: number,
  f: (p: Protocol) => Partial<Protocol>,
) {
  const p = (await context.Protocol.get(PROTOCOL_ID)) ?? emptyProtocol();
  context.Protocol.set({ ...p, ...f(p), updatedAt: BigInt(ts) });
}

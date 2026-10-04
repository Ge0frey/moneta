import { BPS } from "../constants";
import { spotPrice } from "./cpmath";

/**
 * Exact bigint mirror of LaggingOracle.sol. Between updates spot is constant, so the observation's path is known:
 * linear at the capped rate until it reaches spot, then flat. The cumulative integrates that path.
 */

export type OracleState = {
  observation: bigint;
  cumulative: bigint;
  maxStepPerSecond: bigint;
  lastUpdate: bigint;
  twapStart: bigint;
  twapEnd: bigint;
};

export type PoolOracleView = OracleState & { reserveBase: bigint; reserveQuote: bigint };

export function observationAt(obs: bigint, spot: bigint, rate: bigint, elapsed: bigint): bigint {
  const maxDelta = rate * elapsed;
  if (spot > obs) {
    const d = spot - obs;
    return obs + (d < maxDelta ? d : maxDelta);
  }
  const d = obs - spot;
  return obs - (d < maxDelta ? d : maxDelta);
}

export function integral(obs0: bigint, spot: bigint, rate: bigint, u1: bigint, u2: bigint): bigint {
  if (u2 <= u1) return 0n;
  const d = spot > obs0 ? spot - obs0 : obs0 - spot;
  if (d === 0n || rate === 0n) return obs0 * (u2 - u1);
  const reach = d / rate;
  if (u1 >= reach) return spot * (u2 - u1);
  const e = u2 < reach ? u2 : reach;
  const linBase = obs0 * (e - u1);
  const linMove = (rate * (e * e - u1 * u1)) / 2n;
  let area = spot > obs0 ? linBase + linMove : linBase - linMove;
  if (u2 > reach) area += spot * (u2 - reach);
  return area;
}

function accrue(s: OracleState, spot: bigint, ts: bigint): bigint {
  const from = s.lastUpdate > s.twapStart ? s.lastUpdate : s.twapStart;
  const to = ts < s.twapEnd ? ts : s.twapEnd;
  if (to <= from) return s.cumulative;
  return (
    s.cumulative +
    integral(s.observation, spot, s.maxStepPerSecond, from - s.lastUpdate, to - s.lastUpdate)
  );
}

/** Spot of a pool view; a drained/closed pool keeps its last observation. */
export function poolSpot(p: PoolOracleView): bigint {
  if (p.reserveBase === 0n || p.reserveQuote === 0n) return p.observation;
  return spotPrice(p.reserveBase, p.reserveQuote);
}

export function cumulativeAt(p: PoolOracleView, ts: bigint): bigint {
  return accrue(p, poolSpot(p), ts);
}

export function observationNow(p: PoolOracleView, now: bigint): bigint {
  return observationAt(p.observation, poolSpot(p), p.maxStepPerSecond, now - p.lastUpdate);
}

/** TWAP of the elapsed part of the window at `now` (projection); observation before the window opens. */
export function twapSoFar(p: PoolOracleView, now: bigint): bigint {
  if (now <= p.twapStart) return observationNow(p, now);
  const to = now < p.twapEnd ? now : p.twapEnd;
  return cumulativeAt(p, to) / (to - p.twapStart);
}

/** Final TWAP (valid once now >= twapEnd). */
export function twapFinal(p: PoolOracleView): bigint {
  return cumulativeAt(p, p.twapEnd) / (p.twapEnd - p.twapStart);
}

export type VerdictProjection = {
  passing: boolean;
  twapPass: bigint;
  twapFail: bigint;
  /** (twapPass / twapFail − 1) in bps; positive = PASS world priced higher. */
  premiumBps: number;
  /** Premium required to pass (θ). */
  thresholdBps: number;
};

/** Mirrors Treasury._passes: pass ⇔ twapPass·10000 ≥ twapFail·(10000 + θ). */
export function passes(twapPass: bigint, twapFail: bigint, thetaBps: number): boolean {
  return twapPass * BPS >= twapFail * (BPS + BigInt(thetaBps));
}

export function projectVerdict(
  passPool: PoolOracleView,
  failPool: PoolOracleView,
  now: bigint,
  thetaBps: number,
): VerdictProjection {
  const twapPass = twapSoFar(passPool, now);
  const twapFail = twapSoFar(failPool, now);
  const premiumBps = twapFail === 0n ? 0 : Number(((twapPass - twapFail) * BPS) / twapFail);
  return {
    passing: twapFail > 0n && passes(twapPass, twapFail, thetaBps),
    twapPass,
    twapFail,
    premiumBps,
    thresholdBps: thetaBps,
  };
}

import {
  ActionType,
  NO_PERMIT,
  ProposalStatus,
  RaiseStatus,
  readProject,
  readProposal,
  readRaise,
  txs,
  type GovConfig,
  type ProposalAction,
  type RaiseParams,
} from "@moneta/sdk";
import { decodeEventLog, parseUnits, type Address, type PrivateKeyAccount } from "viem";
import { monetaFactoryAbi } from "@moneta/sdk";
import { log, type BotEnv } from "./config.js";
import { advanceTo, ensureApproval, now, send } from "./lib.js";

/** Fast governance (testnet bounds allow minute-scale windows). */
export const FAST_GOV: GovConfig = {
  thetaTrancheBps: 0,
  thetaTeamBps: 100,
  thetaCommunityBps: 300,
  proposalLiquidityBps: 5000,
  maxStepBps: 100,
  warmup: 30,
  duration: 180,
  executionGrace: 600,
  bond: 1_000_000n, // 1 USDC
};

export const usdc = (n: number | string) => parseUnits(String(n), 6);

export type RaiseSpec = {
  name: string;
  symbol: string;
  price: string; // USDC per token
  min: number;
  max: number;
  windowSec: number;
  tranches?: number[];
  budgetPerMonth?: number;
  memo: string;
};

export async function createRaise(
  env: BotEnv,
  founder: PrivateKeyAccount,
  r: RaiseSpec,
): Promise<Address> {
  const t = Number(await now(env));
  const params: RaiseParams = {
    name: r.name,
    symbol: r.symbol,
    quote: env.deployment.quote,
    founder: founder.address,
    price: usdc(r.price),
    minRaise: usdc(r.min),
    maxRaise: usdc(r.max),
    start: t,
    end: t + r.windowSec,
    liquidityBps: 2000,
    budgetPerMonth: usdc(r.budgetPerMonth ?? 30),
    trancheBps: r.tranches ?? [2500, 2500, 2500, 2000],
    perf: [],
    perfCliff: 0,
    perfUnlockWindow: 0,
    gov: FAST_GOV,
  };
  const receipt = await send(
    env,
    founder,
    txs.createRaise(env.deployment, params, r.memo),
    `createRaise ${r.symbol}`,
  );
  for (const l of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: monetaFactoryAbi, data: l.data, topics: l.topics });
      if (ev.eventName === "RaiseCreated") return ev.args.raise;
    } catch {
      /* other contracts' logs */
    }
  }
  throw new Error("RaiseCreated not found");
}

export async function contribute(
  env: BotEnv,
  who: PrivateKeyAccount,
  raise: Address,
  amount: bigint,
) {
  await ensureApproval(env, who, env.deployment.quote, raise, amount);
  await send(
    env,
    who,
    txs.contribute(raise, amount),
    `contribute ${who.address.slice(0, 8)} ${Number(amount) / 1e6} USDC`,
  );
}

export async function finalizeRaise(env: BotEnv, keeper: PrivateKeyAccount, raise: Address) {
  const r = await readRaise(env.publicClient, raise);
  await advanceTo(env, r.end);
  await send(env, keeper, txs.finalizeRaise(raise), `finalize raise ${raise.slice(0, 8)}`);
  return readRaise(env.publicClient, raise);
}

export async function claimAll(env: BotEnv, raise: Address, who: PrivateKeyAccount[]) {
  for (const a of who) {
    const r = await readRaise(env.publicClient, raise, a.address);
    if (r.account && r.account.contribution > 0n && !r.account.claimed) {
      await send(env, a, txs.claim(raise), `claim ${a.address.slice(0, 8)}`);
    }
  }
}

export async function propose(
  env: BotEnv,
  who: PrivateKeyAccount,
  treasury: Address,
  action: ProposalAction,
  memo: string,
): Promise<bigint> {
  await ensureApproval(env, who, env.deployment.quote, treasury, FAST_GOV.bond);
  await send(
    env,
    who,
    txs.propose(treasury, action, memo, NO_PERMIT),
    `propose ${action.type} "${memo.slice(0, 32)}"`,
  );
  const p = await readProject(env.publicClient, env.deployment, treasury);
  return p.proposalCount;
}

export async function buy(
  env: BotEnv,
  who: PrivateKeyAccount,
  treasury: Address,
  id: bigint,
  pass: boolean,
  amount: bigint,
) {
  await ensureApproval(env, who, env.deployment.quote, env.deployment.router, amount);
  await send(
    env,
    who,
    txs.buyOutcome(env.deployment, treasury, id, pass, amount, 0n),
    `buy ${pass ? "PASS" : "FAIL"} ${Number(amount) / 1e6} USDC (${who.address.slice(0, 8)})`,
  );
}

/** Wait for the trading window to end, finalize, return the decided proposal view. */
export async function decide(
  env: BotEnv,
  keeper: PrivateKeyAccount,
  treasury: Address,
  id: bigint,
) {
  const p = await readProject(env.publicClient, env.deployment, treasury);
  const v = await readProposal(env.publicClient, env.deployment, p, id);
  await advanceTo(env, v.proposal.tradingEnd);
  await send(env, keeper, txs.finalizeProposal(treasury, id), `finalize proposal #${id}`);
  const after = await readProposal(env.publicClient, env.deployment, p, id);
  const label = Object.entries(ProposalStatus).find(([, v2]) => v2 === after.proposal.status)?.[0];
  log(
    "verdict",
    `#${id} ${label} (twapPass ${after.proposal.twapPass}, twapFail ${after.proposal.twapFail})`,
  );
  return after;
}

export async function redeemPositions(
  env: BotEnv,
  who: PrivateKeyAccount[],
  treasury: Address,
  id: bigint,
) {
  for (const a of who) {
    await send(
      env,
      a,
      txs.redeemAll(env.deployment, treasury, id),
      `redeemAll #${id} ${a.address.slice(0, 8)}`,
      {
        quiet: true,
      },
    );
  }
}

export { ActionType, RaiseStatus };

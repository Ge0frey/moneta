import { ProposalStatus, ProjectState, RaiseStatus, readProject, txs } from "@moneta/sdk";
import { log, type BotEnv } from "./config.js";
import {
  buy,
  claimAll,
  contribute,
  createRaise,
  decide,
  finalizeRaise,
  propose,
  redeemPositions,
  usdc,
} from "./flows.js";
import { mintUsdc, send } from "./lib.js";

const LUMEN_MEMO = `# Lumen Labs
**Private, verifiable analytics for onchain apps.**

## Thesis
Every Monad app needs analytics; nobody wants to ship user data to a third party. Lumen runs queries over
encrypted event streams and publishes verifiable results onchain.

## Team
- Ada — ex-protocol engineer, 6 yrs distributed systems
- Kofi — ZK researcher

## Milestones (tranches)
1. **Private beta** with 3 Monad apps — 25%
2. **Mainnet v1** + public dashboard — 25%
3. **Self-serve SDK** — 25%
4. **1,000 weekly active projects** — 20%

## Use of funds
Engineering (70%), audits (20%), infra (10%). Operating budget: 30 USDC / month.`;

/**
 * Seeds raises/projects in every lifecycle state: open, failed (refunding), launched with history and a
 * LIVE proposal, and redeemed. Local uses time travel; testnet waits in real time (minute-scale windows).
 */
export async function seed(env: BotEnv) {
  const { founder, traders, keeper } = env.accounts;
  const [a, b, c, d] = traders as [typeof founder, typeof founder, typeof founder, typeof founder];
  if (env.network === "local") {
    await mintUsdc(env, [founder.address, ...traders.map((t) => t.address)], 10_000_000000n);
  }

  log(
    "seed",
    "1/4 creating raises: Nimbus (will fail), Quarry (will be redeemed), Lumen (flagship)",
  );
  const nimbus = await createRaise(env, founder, {
    name: "Nimbus Weather",
    symbol: "NMB",
    price: "0.05",
    min: 500,
    max: 1500,
    windowSec: 600,
    memo: "# Nimbus Weather\nHyperlocal weather oracles. Needed 500 USDC to launch.",
  });
  const quarry = await createRaise(env, founder, {
    name: "Quarry Games",
    symbol: "QRY",
    price: "0.02",
    min: 100,
    max: 400,
    windowSec: 600,
    memo: "# Quarry Games\nOnchain mining sim. Raised, shipped late, and holders chose to redeem.",
  });
  const lumen = await createRaise(env, founder, {
    name: "Lumen Labs",
    symbol: "LUM",
    price: "0.10",
    min: 400,
    max: 1000,
    windowSec: 600,
    memo: LUMEN_MEMO,
  });

  await contribute(env, a, nimbus, usdc(60));
  await contribute(env, b, nimbus, usdc(40));
  await contribute(env, a, quarry, usdc(120));
  await contribute(env, c, quarry, usdc(80));
  await contribute(env, a, lumen, usdc(350));
  await contribute(env, b, lumen, usdc(250));
  await contribute(env, c, lumen, usdc(200));
  await contribute(env, d, lumen, usdc(150));

  log("seed", "2/4 closing raise windows");
  const n = await finalizeRaise(env, keeper, nimbus);
  const q = await finalizeRaise(env, keeper, quarry);
  const l = await finalizeRaise(env, keeper, lumen);
  if (
    n.status !== RaiseStatus.Failed ||
    q.status !== RaiseStatus.Succeeded ||
    l.status !== RaiseStatus.Succeeded
  ) {
    throw new Error("unexpected raise outcomes");
  }
  await claimAll(env, quarry, [a, c]);
  await claimAll(env, lumen, [a, b, c, d]);

  log("seed", "3/4 Quarry: holders redeem at NAV");
  const qr = await propose(
    env,
    c,
    q.treasury,
    { type: "Redeem" },
    "Team missed every milestone — return the treasury.",
  );
  await buy(env, a, q.treasury, qr, true, usdc(60));
  await buy(env, c, q.treasury, qr, true, usdc(40));
  const qv = await decide(env, keeper, q.treasury, qr);
  if (qv.proposal.status !== ProposalStatus.Executed)
    throw new Error("Quarry redemption did not execute");
  await redeemPositions(env, [a, c], q.treasury, qr);
  const qp = await readProject(env.publicClient, env.deployment, q.treasury);
  if (qp.state !== ProjectState.Redeemed) throw new Error("Quarry not redeemed");
  await send(
    env,
    a,
    txs.redeem(q.treasury, (await readTokenBalance(env, qp.token, a.address)) / 2n),
    "partial redemption claim",
  );

  log(
    "seed",
    "4/4 Lumen: a PASSED tranche, a FAILED bad idea, then a LIVE proposal; Atlas left open",
  );
  const t1 = await propose(
    env,
    founder,
    l.treasury,
    { type: "TrancheRelease", index: 0 },
    "Milestone 1: private beta live with 3 Monad apps.",
  );
  await buy(env, a, l.treasury, t1, true, usdc(80));
  await buy(env, b, l.treasury, t1, true, usdc(40));
  await buy(env, d, l.treasury, t1, false, usdc(15));
  await decide(env, keeper, l.treasury, t1);
  await redeemPositions(env, [a, b, d], l.treasury, t1);

  const bad = await propose(
    env,
    d,
    l.treasury,
    {
      type: "Transfer",
      token: env.deployment.quote,
      to: d.address,
      amount: usdc(150),
    },
    "Spend 150 USDC on a celebrity endorsement.",
  );
  await buy(env, a, l.treasury, bad, false, usdc(90));
  await buy(env, c, l.treasury, bad, false, usdc(50));
  await decide(env, keeper, l.treasury, bad);
  await redeemPositions(env, [a, c], l.treasury, bad);

  const live = await propose(
    env,
    founder,
    l.treasury,
    { type: "TrancheRelease", index: 1 },
    "Milestone 2: mainnet v1 shipped + public dashboard.",
  );
  await buy(env, b, l.treasury, live, true, usdc(25));

  const atlas = await createRaise(env, founder, {
    name: "Atlas Maps",
    symbol: "ATL",
    price: "0.08",
    min: 300,
    max: 900,
    windowSec: 3600,
    memo: "# Atlas Maps\nCommunity-owned map tiles for onchain games. Raising now.",
  });
  await contribute(env, b, atlas, usdc(120));
  await contribute(env, d, atlas, usdc(60));

  log(
    "seed",
    `done ✓  Lumen treasury ${l.treasury} (live proposal #${live}), Atlas raise ${atlas}`,
  );
  return { lumen: l.treasury, atlas, quarry: q.treasury, nimbus };
}

async function readTokenBalance(env: BotEnv, token: `0x${string}`, who: `0x${string}`) {
  const { erc20Abi } = await import("viem");
  return env.publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [who],
  });
}

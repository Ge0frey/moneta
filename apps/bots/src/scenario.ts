import {
  ProposalStatus,
  ProjectState,
  RaiseStatus,
  readProject,
  readRaise,
  txs,
} from "@moneta/sdk";
import { erc20Abi } from "viem";
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
import { mintUsdc, send, usdcBalance } from "./lib.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`SCENARIO ASSERTION FAILED: ${msg}`);
  log("assert", `✓ ${msg}`);
}

/**
 * The full lifecycle, headless, through the SDK tx pipeline over JSON-RPC:
 * create → raise → launch → claim → tranche PASS (executes) → bad idea FAIL (capital stays) → redemption → claims.
 * Local runs in seconds (time travel); testnet runs in real time with small USDC amounts.
 */
export async function scenario(env: BotEnv) {
  const { founder, keeper, traders } = env.accounts;
  const [a, b, c] = traders as [typeof founder, typeof founder, typeof founder];
  const scale = env.network === "local" ? 1 : 0.05; // testnet: tiny amounts (Circle faucet = 20 USDC / 2h)
  const amt = (n: number) => usdc((n * scale).toFixed(6));
  if (env.network === "local")
    await mintUsdc(env, [founder.address, a.address, b.address, c.address], 5_000_000000n);

  const raise = await createRaise(env, founder, {
    name: "Scenario Labs",
    symbol: "SCN",
    price: (0.1 * scale).toFixed(6),
    min: 400 * scale,
    max: 1000 * scale,
    windowSec: env.network === "local" ? 600 : 120,
    memo: "# Scenario Labs\nHeadless end-to-end lifecycle check.",
  });
  await contribute(env, a, raise, amt(450));
  await contribute(env, b, raise, amt(350));
  await contribute(env, c, raise, amt(200));
  const r = await finalizeRaise(env, keeper, raise);
  assert(
    r.status === RaiseStatus.Succeeded,
    "raise launched atomically (token + liquidity + treasury)",
  );
  await claimAll(env, raise, [a, b, c]);
  const claimed = await readRaise(env.publicClient, raise, a.address);
  assert(claimed.account?.claimed, "backer claimed tokens");

  const t = r.treasury;
  const tranche = await propose(
    env,
    founder,
    t,
    { type: "TrancheRelease", index: 1 },
    "Mainnet v1 shipped",
  );
  const founderBefore = await usdcBalance(env, founder.address);
  await buy(env, a, t, tranche, true, amt(120));
  await buy(env, b, t, tranche, true, amt(60));
  await buy(env, c, t, tranche, false, amt(20));
  const v1 = await decide(env, keeper, t, tranche);
  assert(
    v1.proposal.status === ProposalStatus.Executed,
    "Verdict PASS → tranche executed automatically",
  );
  const p1 = await readProject(env.publicClient, env.deployment, t);
  assert(p1.tranches[1]!.released, "tranche 2 marked released");
  assert((await usdcBalance(env, founder.address)) > founderBefore, "founder received the tranche");
  await redeemPositions(env, [a, b, c], t, tranche);

  const before = p1.availableQuote;
  const bad = await propose(
    env,
    c,
    t,
    { type: "Transfer", token: env.deployment.quote, to: c.address, amount: (before * 40n) / 100n },
    "Celebrity endorsement",
  );
  await buy(env, a, t, bad, false, amt(150));
  await buy(env, b, t, bad, false, amt(80));
  const v2 = await decide(env, keeper, t, bad);
  assert(v2.proposal.status === ProposalStatus.Failed, "Verdict FAIL → nothing executed");
  const p2 = await readProject(env.publicClient, env.deployment, t);
  assert(p2.availableQuote >= before, "capital stayed in the treasury");
  await redeemPositions(env, [a, b], t, bad);

  const red = await propose(env, c, t, { type: "Redeem" }, "Wind down");
  await buy(env, a, t, red, true, amt(200));
  await buy(env, b, t, red, true, amt(100));
  const v3 = await decide(env, keeper, t, red);
  assert(v3.proposal.status === ProposalStatus.Executed, "Redemption passed and executed");
  await redeemPositions(env, [a, b, c], t, red);
  const p3 = await readProject(env.publicClient, env.deployment, t);
  assert(p3.state === ProjectState.Redeemed, "project redeemed");
  const bal = await env.publicClient.readContract({
    address: p3.token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [a.address],
  });
  const usdcBefore = await usdcBalance(env, a.address);
  await send(env, a, txs.redeem(t, bal), "holder redeems at NAV");
  assert((await usdcBalance(env, a.address)) > usdcBefore, "holder paid pro-rata USDC");

  log("scenario", "SCENARIO OK ✓ — create → raise → launch → PASS → FAIL → redemption");
}

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ProposalStatus,
  quoteAssets,
  quoteSwap,
  readBalances,
  readProposal,
  spotPrice,
  treasuryAbi,
  txs,
  withSlippage,
  type PoolView,
} from "@moneta/sdk";
import { maxUint256, type Address } from "viem";
import { log, type BotEnv } from "./config.js";
import {
  ensureApproval,
  listTreasuries,
  mintTestQuote,
  mintUsdc,
  sleep,
  trySend,
  usdcBalance,
} from "./lib.js";
import { buyToTarget, gauss, passProbability, sellToTarget, type Scenario } from "./market.js";

const MIN_TRADE = 50_000n; // 0.05 USDC
const MIN_TOKENS = 10n ** 15n; // 0.001 token
const BOT_SLIPPAGE_BPS = 300;
const DEADBAND_BPS = 50; // don't trade when within 0.5% of the belief

const here = dirname(fileURLToPath(import.meta.url));

function loadScenario(): Scenario {
  const file = process.env.TRADER_SCENARIO ?? join(here, "../scenarios/default.json");
  return JSON.parse(readFileSync(file, "utf8")) as Scenario;
}

/**
 * Market makers — belief-driven bots that keep decision markets alive without running them over.
 *
 * Each trader holds a fair value for the token in each world: the opening price moved by an edge that follows the
 * scenario's view of the proposal (PASS for milestone tranches, FAIL for value-destroying ideas, …), plus personal
 * noise. Each tick it picks a world, buys if the pool trades below its belief and sells if above, sized to close
 * the gap but capped by `maxPoolShareBps` of the pool and `tradeSize.max`. Prices therefore converge and
 * oscillate around a consensus instead of trending forever, and a human trade gets arbitraged back — the way a
 * real decision market behaves.
 */
export async function runTraders(env: BotEnv, opts: { intervalMs?: number } = {}) {
  const scenario = loadScenario();
  const interval = opts.intervalMs ?? 3000;
  const traders = env.accounts.traders;
  const share = BigInt(scenario.maxPoolShareBps ?? 150);
  const maxEdge = scenario.maxEdgeBps ?? 3000;
  const noise = scenario.noiseBps ?? 150;
  const maxSpend = BigInt(Math.round(scenario.tradeSize.max * 1e6));
  log("traders", `${traders.length} traders on ${env.chain.name}`);

  if (env.network === "local") {
    const poor: Address[] = [];
    for (const t of traders)
      if ((await usdcBalance(env, t.address)) < 1000_000000n) poor.push(t.address);
    if (poor.length) await mintUsdc(env, poor, 10_000_000000n);
  }
  // Test quote (mUSDC): open mint on every network, so traders fund themselves for mUSDC markets.
  const testQuote = env.deployment.testQuote;
  if (testQuote)
    for (const t of traders)
      if ((await usdcBalance(env, t.address, testQuote)) < 1000_000000n)
        await mintTestQuote(env, t, 10_000_000000n);
  for (const q of quoteAssets(env.deployment))
    for (const t of traders)
      await ensureApproval(env, t, q.address, env.deployment.router, maxUint256 / 2n);

  const meta = new Map<Address, { token: Address; quote: Address }>();
  // belief offset per (proposal, trader, side), fixed for the life of the market
  const beliefs = new Map<string, number>();
  // traders that already took their market-neutral starting inventory in a proposal
  const seeded = new Set<string>();

  for (;;) {
    try {
      for (const treasury of await listTreasuries(env)) {
        const activeId = await env.publicClient.readContract({
          address: treasury,
          abi: treasuryAbi,
          functionName: "activeProposalId",
        });
        if (activeId === 0n) continue;
        if (!meta.has(treasury)) {
          const [token, quote] = await Promise.all([
            env.publicClient.readContract({
              address: treasury,
              abi: treasuryAbi,
              functionName: "token",
            }),
            env.publicClient.readContract({
              address: treasury,
              abi: treasuryAbi,
              functionName: "quote",
            }),
          ]);
          meta.set(treasury, { token, quote });
        }
        const { quote } = meta.get(treasury)!;
        const view = await readProposal(
          env.publicClient,
          env.deployment,
          { treasury, ...meta.get(treasury)! },
          activeId,
        );
        const pr = view.proposal;
        if (pr.status !== ProposalStatus.Active || !view.passPool || !view.failPool || !view.tokens)
          continue;
        if (view.now >= BigInt(pr.tradingEnd)) continue;
        let memo = "";
        try {
          memo = (await env.indexer.proposal(treasury, activeId))?.memo ?? "";
        } catch {
          /* indexer optional */
        }
        const pPass = passProbability(scenario, pr.actionType, memo);
        const edge = (pPass - 0.5) * 2 * maxEdge; // bps: + for PASS, mirrored for FAIL
        const open = spotPrice(pr.migratedBase, pr.migratedQuote);

        for (const trader of traders) {
          // Market-neutral inventory: buy both worlds equally once, so the trader can later sell whichever is
          // overpriced (equal buys move both pools alike and leave the PASS/FAIL premium unchanged).
          const seedKey = `${treasury}-${activeId}-${trader.address}`;
          if (!seeded.has(seedKey)) {
            seeded.add(seedKey);
            const seed = (view.passPool.reserveQuote * share) / 20_000n; // half a max trade per side
            if (seed >= MIN_TRADE && (await usdcBalance(env, trader.address, quote)) >= seed * 2n) {
              for (const side of [true, false]) {
                await trySend(
                  env,
                  trader,
                  txs.buyOutcome(env.deployment, treasury, activeId, side, seed, 0n),
                  `trader ${trader.address.slice(0, 6)} seeds ${side ? "PASS" : "FAIL"} #${activeId}`,
                );
              }
            }
            continue;
          }
          if (Math.random() > scenario.tradeProbability) continue;
          const pass = Math.random() < 0.5;
          const pool: PoolView = pass ? view.passPool : view.failPool;
          const key = `${treasury}-${activeId}-${trader.address}-${pass}`;
          if (!beliefs.has(key)) beliefs.set(key, gauss() * noise);
          const beliefBps = Math.round((pass ? edge : -edge) + beliefs.get(key)!);
          const target = (open * BigInt(10_000 + beliefBps)) / 10_000n;
          const price = spotPrice(pool.reserveBase, pool.reserveQuote);
          if (price === 0n || target === 0n) continue;
          const gapBps = Number(((target - price) * 10_000n) / price);
          if (Math.abs(gapBps) < DEADBAND_BPS) continue;
          const label = `${trader.address.slice(0, 6)} ${pass ? "PASS" : "FAIL"} #${activeId}`;

          if (gapBps > 0) {
            // Underpriced in this world → buy toward the belief.
            const amount = buyToTarget(pool, target, share, maxSpend);
            if (amount < MIN_TRADE || (await usdcBalance(env, trader.address, quote)) < amount)
              continue;
            const out = quoteSwap(
              {
                reserveBase: pool.reserveBase,
                reserveQuote: pool.reserveQuote,
                feeBps: pool.feeBps,
              },
              false,
              amount,
            ).amountOut;
            await trySend(
              env,
              trader,
              txs.buyOutcome(
                env.deployment,
                treasury,
                activeId,
                pass,
                amount,
                withSlippage(out, BOT_SLIPPAGE_BPS),
              ),
              `trader ${label} buy ${(Number(amount) / 1e6).toFixed(2)} (gap ${(gapBps / 100).toFixed(1)}%)`,
            );
          } else {
            // Overpriced → sell side tokens it holds. Tokens needed: B·(√(price/target) − 1).
            const sideToken = pass ? view.tokens.passToken : view.tokens.failToken;
            const held =
              (await readBalances(env.publicClient, trader.address, [sideToken]))[sideToken] ?? 0n;
            const amount = sellToTarget(pool, target, share, held);
            if (amount < MIN_TOKENS) continue;
            const out = quoteSwap(
              {
                reserveBase: pool.reserveBase,
                reserveQuote: pool.reserveQuote,
                feeBps: pool.feeBps,
              },
              true,
              amount,
            ).amountOut;
            await trySend(
              env,
              trader,
              txs.sellOutcome(
                env.deployment,
                treasury,
                activeId,
                pass,
                amount,
                withSlippage(out, BOT_SLIPPAGE_BPS),
              ),
              `trader ${label} sell ${(Number(amount) / 1e18).toFixed(3)} (gap ${(gapBps / 100).toFixed(1)}%)`,
            );
          }
        }
      }
    } catch (err) {
      log("traders", `loop error: ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(interval);
  }
}

import { ProposalStatus, RaiseStatus, readPool, readRaise, treasuryAbi, txs } from "@moneta/sdk";
import type { Address } from "viem";
import { log, type BotEnv } from "./config.js";
import { listRaises, listTreasuries, now, sleep, trySend } from "./lib.js";

/**
 * Keeper — makes permissionless protocol actions happen on time. Trustless: every action
 * is something anyone could do; the keeper only removes the need to wait for a human.
 *  - finalize raises when their window ends (and abort if finalize is impossible after the grace period)
 *  - finalize proposals when their trading window ends (verdict + execution + queued activation)
 *  - retry PASSED proposals whose execution failed, while the grace window is open
 *  - crank decision-market pools periodically so charts get fresh observation points (verdicts do NOT depend on it)
 */
export async function runKeeper(
  env: BotEnv,
  opts: { intervalMs?: number; crankEverySec?: number; once?: boolean } = {},
) {
  const interval = opts.intervalMs ?? (env.network === "local" ? 1500 : 2000);
  const crankEvery = BigInt(opts.crankEverySec ?? 3);
  const keeper = env.accounts.keeper;
  const settledRaises = new Set<Address>();
  log("keeper", `running as ${keeper.address} on ${env.chain.name}`);

  for (;;) {
    try {
      const t = await now(env);

      for (const raise of await listRaises(env)) {
        if (settledRaises.has(raise)) continue;
        const r = await readRaise(env.publicClient, raise);
        if (r.status !== RaiseStatus.Open) {
          settledRaises.add(raise);
          continue;
        }
        if (t >= BigInt(r.end)) {
          const ok = await trySend(
            env,
            keeper,
            txs.finalizeRaise(raise),
            `finalize raise ${raise.slice(0, 8)}`,
          );
          if (!ok && t >= BigInt(r.end + r.finalizeGrace)) {
            await trySend(
              env,
              keeper,
              txs.abortRaise(raise),
              `abort raise ${raise.slice(0, 8)} (grace passed)`,
            );
          }
        }
      }

      for (const treasury of await listTreasuries(env)) {
        const [activeId, count] = await Promise.all([
          env.publicClient.readContract({
            address: treasury,
            abi: treasuryAbi,
            functionName: "activeProposalId",
          }),
          env.publicClient.readContract({
            address: treasury,
            abi: treasuryAbi,
            functionName: "proposalCount",
          }),
        ]);

        if (activeId > 0n) {
          const p = await env.publicClient.readContract({
            address: treasury,
            abi: treasuryAbi,
            functionName: "proposal",
            args: [activeId],
          });
          if (t >= BigInt(p.tradingEnd)) {
            await trySend(
              env,
              keeper,
              txs.finalizeProposal(treasury, activeId),
              `finalize proposal ${treasury.slice(0, 8)}#${activeId}`,
            );
          } else {
            for (const poolId of [p.passPoolId, p.failPoolId]) {
              const pool = await readPool(env.publicClient, env.deployment.amm, poolId);
              if (t - pool.lastUpdate >= crankEvery) {
                await trySend(
                  env,
                  keeper,
                  txs.crank(env.deployment, poolId),
                  `crank pool ${poolId}`,
                );
              }
            }
          }
        }

        // retry recent PASSED-but-not-executed proposals (execution failed / gas-griefed)
        for (let id = count; id > 0n && id > count - 3n; id--) {
          const p = await env.publicClient.readContract({
            address: treasury,
            abi: treasuryAbi,
            functionName: "proposal",
            args: [id],
          });
          if (p.status !== ProposalStatus.Passed) continue;
          const cfg = await env.publicClient.readContract({
            address: treasury,
            abi: treasuryAbi,
            functionName: "config",
          });
          if (t <= BigInt(p.tradingEnd) + BigInt(cfg.executionGrace)) {
            await trySend(
              env,
              keeper,
              txs.executeProposal(treasury, id),
              `retry execution ${treasury.slice(0, 8)}#${id}`,
            );
          }
        }
      }
    } catch (err) {
      log("keeper", `loop error: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (opts.once) return;
    await sleep(interval);
  }
}

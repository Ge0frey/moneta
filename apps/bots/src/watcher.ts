import {
  conditionalVaultAbi,
  monetaAmmAbi,
  Outcome,
  ProposalStatus,
  quoteAssets,
  RaiseStatus,
  readRaise,
  treasuryAbi,
} from "@moneta/sdk";
import { erc20Abi, formatEther, type Address } from "viem";
import { log, type BotEnv } from "./config.js";
import { listRaises, listTreasuries, now, sleep } from "./lib.js";

type Severity = "info" | "warning" | "critical";

async function alert(severity: Severity, message: string) {
  log(`watcher:${severity}`, message);
  const hook = process.env.ALERT_WEBHOOK_URL;
  if (!hook || severity === "info") return;
  try {
    await fetch(hook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: `**[moneta ${severity}]** ${message}` }),
    });
  } catch {
    /* alerting must never crash the watcher */
  }
}

/**
 * Watcher: solvency invariants, liveness, ops wallets, indexer lag. Read-only — never sends txs.
 */
export async function checkOnce(env: BotEnv): Promise<{ critical: number; warnings: number }> {
  let critical = 0;
  let warnings = 0;
  const fire = async (s: Severity, m: string) => {
    if (s === "critical") critical++;
    if (s === "warning") warnings++;
    await alert(s, m);
  };
  const pc = env.publicClient;
  const t = await now(env);

  // Per quote asset (USDC, and mUSDC when deployed): the router never holds funds, and the AMM's balance covers
  // the quote side of every pool that trades against it.
  const poolCount = await pc.readContract({
    address: env.deployment.amm,
    abi: monetaAmmAbi,
    functionName: "poolCount",
  });
  const pools = [];
  for (let i = 1n; i <= poolCount; i++) {
    pools.push(
      await pc.readContract({
        address: env.deployment.amm,
        abi: monetaAmmAbi,
        functionName: "getPool",
        args: [i],
      }),
    );
  }
  for (const q of quoteAssets(env.deployment)) {
    const balanceOf = (who: Address) =>
      pc.readContract({
        address: q.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [who],
      });
    const routerUsdc = await balanceOf(env.deployment.router);
    if (routerUsdc > 0n)
      await fire("critical", `router holds ${routerUsdc} ${q.symbol} (must be 0)`);
    const usdcReserves = pools
      .filter((p) => p.quote.toLowerCase() === q.address.toLowerCase())
      .reduce((a, p) => a + p.reserveQuote, 0n);
    const ammUsdc = await balanceOf(env.deployment.amm);
    if (ammUsdc < usdcReserves)
      await fire("critical", `AMM ${q.symbol} ${ammUsdc} < reserves ${usdcReserves}`);
  }

  // Liveness: raises
  for (const raise of await listRaises(env)) {
    const r = await readRaise(pc, raise);
    if (r.status === RaiseStatus.Open && t > BigInt(r.end) + 60n) {
      await fire(
        "warning",
        `raise ${raise} ended ${t - BigInt(r.end)}s ago but is not finalized (keeper down?)`,
      );
    }
  }

  // Treasuries: bonds covered, proposal liveness, vault solvency of the active condition
  for (const treasury of await listTreasuries(env)) {
    const [bonds, activeId, quote] = await Promise.all([
      pc.readContract({ address: treasury, abi: treasuryAbi, functionName: "bondsHeld" }),
      pc.readContract({ address: treasury, abi: treasuryAbi, functionName: "activeProposalId" }),
      pc.readContract({ address: treasury, abi: treasuryAbi, functionName: "quote" }),
    ]);
    const bal = await pc.readContract({
      address: quote,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [treasury],
    });
    if (bal < bonds) await fire("critical", `treasury ${treasury} USDC ${bal} < bonds ${bonds}`);
    if (activeId === 0n) continue;
    const p = await pc.readContract({
      address: treasury,
      abi: treasuryAbi,
      functionName: "proposal",
      args: [activeId],
    });
    if (p.status === ProposalStatus.Active && t > BigInt(p.tradingEnd) + 60n) {
      await fire(
        "warning",
        `proposal ${treasury}#${activeId} ended ${t - BigInt(p.tradingEnd)}s ago, not finalized`,
      );
    }
    const [passQ, failQ] = await pc.readContract({
      address: env.deployment.vault,
      abi: conditionalVaultAbi,
      functionName: "tokensOf",
      args: [p.conditionId, quote],
    });
    const [held, outcome, sPass, sFail] = await Promise.all([
      pc.readContract({
        address: env.deployment.vault,
        abi: conditionalVaultAbi,
        functionName: "collateralHeld",
        args: [p.conditionId, quote],
      }),
      pc.readContract({
        address: env.deployment.vault,
        abi: conditionalVaultAbi,
        functionName: "outcomeOf",
        args: [p.conditionId],
      }),
      pc.readContract({ address: passQ, abi: erc20Abi, functionName: "totalSupply" }),
      pc.readContract({ address: failQ, abi: erc20Abi, functionName: "totalSupply" }),
    ]);
    if (outcome === Outcome.Unresolved && (held !== sPass || held !== sFail)) {
      await fire(
        "critical",
        `vault condition ${p.conditionId} collateral ${held} != supplies ${sPass}/${sFail}`,
      );
    }
  }

  // Ops wallets: keep >= 10 MON reserve + buffer (Monad reserve balance rule)
  const ops: [string, Address][] = [
    ["keeper", env.accounts.keeper.address],
    ...env.accounts.traders.map((a, i) => [`trader${i}`, a.address] as [string, Address]),
  ];
  for (const [name, addr] of ops) {
    const b = await pc.getBalance({ address: addr });
    if (b < 15n * 10n ** 18n)
      await fire("warning", `${name} ${addr} low on gas: ${formatEther(b)} MON (< 15)`);
  }

  // Indexer lag
  try {
    const meta = await env.indexer.meta();
    const head = await pc.getBlockNumber();
    const lag = meta ? Number(head) - meta.progressBlock : Infinity;
    if (lag > 200) await fire("critical", `indexer lag ${lag} blocks`);
    else if (lag > 20) await fire("warning", `indexer lag ${lag} blocks`);
  } catch {
    await fire("warning", "indexer unreachable");
  }

  return { critical, warnings };
}

export async function runWatcher(env: BotEnv, opts: { intervalMs?: number; once?: boolean } = {}) {
  log("watcher", `watching ${env.chain.name}`);
  for (;;) {
    try {
      const { critical, warnings } = await checkOnce(env);
      log("watcher", `checks done — ${critical} critical, ${warnings} warnings`);
      if (opts.once) return { critical, warnings };
    } catch (err) {
      log("watcher", `check error: ${err instanceof Error ? err.message : String(err)}`);
      if (opts.once) throw err;
    }
    await sleep(opts.intervalMs ?? 30_000);
  }
}

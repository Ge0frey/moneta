#!/usr/bin/env tsx
/**
 * Moneta bots CLI.
 *   tsx src/index.ts <keeper|traders|watcher|all|seed|scenario|check> [--network local|testnet]
 */
import { loadEnv, log } from "./config.js";
import { runKeeper } from "./keeper.js";
import { scenario } from "./scenario.js";
import { seed } from "./seed.js";
import { runTraders } from "./traders.js";
import { checkOnce, runWatcher } from "./watcher.js";

const cmd = process.argv[2] ?? "all";
const env = loadEnv();
log("bots", `${cmd} on ${env.chain.name} (factory ${env.deployment.factory})`);

switch (cmd) {
  case "keeper":
    await runKeeper(env);
    break;
  case "traders":
    await runTraders(env);
    break;
  case "watcher":
    await runWatcher(env);
    break;
  case "all":
    await Promise.all([runKeeper(env), runTraders(env), runWatcher(env)]);
    break;
  case "seed":
    await seed(env);
    break;
  case "scenario":
    await scenario(env);
    break;
  case "check": {
    const r = await checkOnce(env);
    log("check", `${r.critical} critical, ${r.warnings} warnings`);
    process.exit(r.critical > 0 ? 1 : 0);
  }
  default:
    console.error(`unknown command: ${cmd}`);
    process.exit(1);
}

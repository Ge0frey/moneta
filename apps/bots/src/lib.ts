import {
  chainNow,
  monetaUsdcAbi,
  monetaFactoryAbi,
  sendTx,
  TxError,
  txs,
  type WriteRequest,
} from "@moneta/sdk";
import {
  erc20Abi,
  maxUint256,
  type Address,
  type PrivateKeyAccount,
  type TransactionReceipt,
} from "viem";
import { log, type BotEnv } from "./config.js";

/** Send a protocol tx through the SDK pipeline (simulate → estimate×1.15 → send → receipt). */
export async function send(
  env: BotEnv,
  account: PrivateKeyAccount,
  request: WriteRequest,
  label: string,
  opts: { quiet?: boolean } = {},
): Promise<TransactionReceipt> {
  const { receipt } = await sendTx({
    publicClient: env.publicClient,
    walletClient: env.wallet(account),
    account,
    request,
    chain: env.chain,
  });
  if (!opts.quiet) log("tx", `${label} ✓ block ${receipt.blockNumber} gas ${receipt.gasUsed}`);
  return receipt;
}

/** Same as send, but returns null (and logs) instead of throwing. For best-effort automation. */
export async function trySend(
  env: BotEnv,
  account: PrivateKeyAccount,
  request: WriteRequest,
  label: string,
) {
  try {
    return await send(env, account, request, label);
  } catch (err) {
    const msg =
      err instanceof TxError
        ? `${err.message}${err.errorName ? ` (${err.errorName})` : ""}`
        : String(err);
    log("tx", `${label} ✗ ${msg}`);
    return null;
  }
}

export const now = (env: BotEnv) => chainNow(env.publicClient);

/** Advance chain time: anvil time travel locally; real waiting on testnet. */
export async function advance(env: BotEnv, seconds: number) {
  if (env.network === "local") {
    await env.publicClient.request({
      method: "evm_increaseTime" as never,
      params: [seconds] as never,
    });
    await env.publicClient.request({ method: "evm_mine" as never, params: [] as never });
    return;
  }
  const target = (await now(env)) + BigInt(seconds);
  log("time", `waiting ${seconds}s of chain time…`);
  while ((await now(env)) < target) await sleep(1000);
}

export async function advanceTo(env: BotEnv, ts: bigint | number) {
  const t = await now(env);
  const delta = Number(BigInt(ts) - t);
  if (delta > 0) await advance(env, delta + 1);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** All raise addresses, read from the factory (chain-authoritative; works without the indexer). */
export async function listRaises(env: BotEnv): Promise<Address[]> {
  const count = await env.publicClient.readContract({
    address: env.deployment.factory,
    abi: monetaFactoryAbi,
    functionName: "raiseCount",
  });
  if (count === 0n) return [];
  const res = await env.publicClient.multicall({
    allowFailure: false,
    contracts: Array.from({ length: Number(count) }, (_, i) => ({
      address: env.deployment.factory,
      abi: monetaFactoryAbi,
      functionName: "raiseOf" as const,
      args: [BigInt(i + 1)] as const,
    })),
  });
  return res as Address[];
}

/** Launched projects: [projectId, token, treasury]. */
export async function listTreasuries(env: BotEnv): Promise<Address[]> {
  const count = await env.publicClient.readContract({
    address: env.deployment.factory,
    abi: monetaFactoryAbi,
    functionName: "raiseCount",
  });
  if (count === 0n) return [];
  const res = await env.publicClient.multicall({
    allowFailure: false,
    contracts: Array.from({ length: Number(count) }, (_, i) => ({
      address: env.deployment.factory,
      abi: monetaFactoryAbi,
      functionName: "projectOf" as const,
      args: [BigInt(i + 1)] as const,
    })),
  });
  return (res as [Address, Address][])
    .map(([, t]) => t)
    .filter((t) => t !== "0x0000000000000000000000000000000000000000");
}

/** Local only: mint MonetaUSDC (open mint) to accounts. */
export async function mintUsdc(env: BotEnv, to: Address[], amount: bigint) {
  if (env.network !== "local") throw new Error("mintUsdc is local-only (testnet uses Circle USDC)");
  const minter = env.accounts.deployer!;
  for (const a of to) {
    await send(
      env,
      minter,
      {
        address: env.deployment.quote,
        abi: monetaUsdcAbi as never,
        functionName: "mint",
        args: [a, amount],
      },
      `mint USDC → ${a.slice(0, 8)}`,
      { quiet: true },
    );
  }
}

/** Ensure `owner` has approved `spender` for `token` (max). */
export async function ensureApproval(
  env: BotEnv,
  owner: PrivateKeyAccount,
  token: Address,
  spender: Address,
  need: bigint,
) {
  const allowance = await env.publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner.address, spender],
  });
  if (allowance >= need) return;
  await send(
    env,
    owner,
    txs.approve(token, spender, maxUint256),
    `approve ${spender.slice(0, 8)}`,
    { quiet: true },
  );
}

/** Open mint of the test quote (mUSDC) to `account` itself, so it works on testnet without the deployer key. */
export async function mintTestQuote(env: BotEnv, account: PrivateKeyAccount, amount: bigint) {
  const testQuote = env.deployment.testQuote;
  if (!testQuote) throw new Error("no test quote on this deployment (script/test-quote.sh)");
  await send(
    env,
    account,
    txs.mintTestQuote(testQuote, account.address, amount),
    `mint mUSDC → ${account.address.slice(0, 8)}`,
    { quiet: true },
  );
}

/** Quote balance; the primary quote unless `token` names another (a project's own quote). */
export async function usdcBalance(
  env: BotEnv,
  who: Address,
  token: Address = env.deployment.quote,
) {
  return env.publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [who],
  });
}

export function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

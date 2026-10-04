import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getDeployment,
  IndexerClient,
  localAnvil,
  monadTestnet,
  type DeploymentRecord,
} from "@moneta/sdk";
import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  type Chain,
  type Hex,
  type PrivateKeyAccount,
  type PublicClient,
  type WalletClient,
} from "viem";
import { mnemonicToAccount, nonceManager, privateKeyToAccount } from "viem/accounts";

const here = dirname(fileURLToPath(import.meta.url));
const rootEnv = join(here, "../../../.env");

/** Minimal .env loader (no dependency): root .env, never overriding real environment variables. */
if (existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]!] === undefined && m[2] !== "") process.env[m[1]!] = m[2];
  }
}

/** anvil's public dev mnemonic — LOCAL ONLY. */
const ANVIL_MNEMONIC = "test test test test test test test test test test test junk";

export type Network = "local" | "testnet";

export type BotEnv = {
  network: Network;
  chain: Chain;
  deployment: DeploymentRecord;
  publicClient: PublicClient;
  indexer: IndexerClient;
  wallet: (account: PrivateKeyAccount) => WalletClient;
  /** Account by role. Local: anvil dev accounts. Testnet: env keys / TRADER_MNEMONIC. */
  accounts: {
    keeper: PrivateKeyAccount;
    founder: PrivateKeyAccount;
    traders: PrivateKeyAccount[];
    deployer?: PrivateKeyAccount;
  };
};

export function argNetwork(): Network {
  const i = process.argv.indexOf("--network");
  const v = i >= 0 ? process.argv[i + 1] : process.env.BOTS_NETWORK;
  return v === "testnet" ? "testnet" : "local";
}

export function loadEnv(network: Network = argNetwork()): BotEnv {
  const chain = network === "testnet" ? monadTestnet : localAnvil;
  const urls =
    network === "testnet"
      ? [process.env.RPC_URL, ...monadTestnet.rpcUrls.default.http].filter(Boolean)
      : [process.env.LOCAL_RPC_URL ?? "http://127.0.0.1:8545"];
  const transport = fallback(
    urls.map((u) => http(u as string, { retryCount: 3, retryDelay: 400 })),
  );
  const publicClient = createPublicClient({
    chain,
    transport,
    pollingInterval: 500,
  }) as PublicClient;

  const fromMnemonic = (m: string, i: number) => {
    const acc = mnemonicToAccount(m, { addressIndex: i });
    // mnemonic accounts → equivalent private-key accounts with nonce management
    return privateKeyToAccount(toHex(acc.getHdKey().privateKey!), { nonceManager });
  };
  let accounts: BotEnv["accounts"];
  if (network === "local") {
    accounts = {
      deployer: fromMnemonic(ANVIL_MNEMONIC, 0),
      founder: fromMnemonic(ANVIL_MNEMONIC, 3),
      traders: [4, 5, 6, 7].map((i) => fromMnemonic(ANVIL_MNEMONIC, i)),
      keeper: fromMnemonic(ANVIL_MNEMONIC, 8),
    };
  } else {
    const keeperKey = process.env.KEEPER_KEY as Hex | undefined;
    const mnemonic = process.env.TRADER_MNEMONIC;
    if (!keeperKey || !mnemonic) {
      throw new Error("testnet bots need KEEPER_KEY and TRADER_MNEMONIC (see .env.example)");
    }
    accounts = {
      keeper: privateKeyToAccount(keeperKey, { nonceManager }),
      founder: fromMnemonic(mnemonic, 0),
      traders: [1, 2, 3, 4].map((i) => fromMnemonic(mnemonic, i)),
    };
  }

  return {
    network,
    chain,
    deployment: getDeployment(chain.id),
    publicClient,
    indexer: new IndexerClient(process.env.INDEXER_URL ?? "http://localhost:8080/v1/graphql"),
    wallet: (account) => createWalletClient({ account, chain, transport }),
    accounts,
  };
}

function toHex(bytes: Uint8Array): Hex {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

export const log = (scope: string, ...args: unknown[]) =>
  console.log(`${new Date().toISOString().slice(11, 19)} [${scope}]`, ...args);

"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  okxWallet,
  phantomWallet,
  rabbyWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, fallback, http } from "wagmi";
import { mock as scriptedWallet } from "wagmi/connectors";
import { privateKeyToAccount } from "viem/accounts";
import { localAnvil } from "@moneta/sdk";
import { CHAIN, CHAIN_ID, RPC_URLS, WALLETCONNECT_PROJECT_ID } from "./env";

/**
 * wagmi config. RPC: fallback chain (keyed provider first, then public), multicall batching via Multicall3
 * (Monad's Foundation RPC rejects JSON-RPC batches).
 */
const walletList = [
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  okxWallet,
  phantomWallet,
  ...(WALLETCONNECT_PROJECT_ID ? [walletConnectWallet] : []),
];

const rainbowConnectors = connectorsForWallets([{ groupName: "Wallets", wallets: walletList }], {
  appName: "Moneta",
  projectId: WALLETCONNECT_PROJECT_ID || "moneta-injected-only",
});

/**
 * E2E only (NEXT_PUBLIC_E2E_KEY set): a scripted wallet driven by an anvil dev key. That key is public, so the
 * scripted wallet is only ever enabled on the local chain.
 */
const e2eKey =
  CHAIN_ID === localAnvil.id
    ? (process.env.NEXT_PUBLIC_E2E_KEY as `0x${string}` | undefined)
    : undefined;
export const E2E_MODE = !!e2eKey;
export { scriptedWallet };
const e2eConnectors = e2eKey
  ? [
      scriptedWallet({
        accounts: [privateKeyToAccount(e2eKey).address],
        features: { reconnect: true },
      }),
    ]
  : [];

const urls = RPC_URLS.length ? RPC_URLS : CHAIN.rpcUrls.default.http;
const transport = fallback(
  urls.map((u) => http(u, { batch: false, retryCount: 2, retryDelay: 300 })),
  { rank: false },
);

export const wagmiConfig = createConfig({
  chains: [CHAIN],
  connectors: [...e2eConnectors, ...rainbowConnectors],
  transports: { 10143: transport, 31337: transport },
  batch: { multicall: true },
  pollingInterval: 1000,
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

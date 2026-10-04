import { defineChain, type Chain } from "viem";

/** Monad testnet (chain 10143). 300 ms blocks, ~600 ms finality, second-granularity timestamps. */
export const monadTestnet = defineChain({
  id: 10_143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        "https://testnet-rpc.monad.xyz",
        "https://rpc.ankr.com/monad_testnet",
        "https://rpc-testnet.monadinfra.com",
      ],
      webSocket: ["wss://testnet-rpc.monad.xyz"],
    },
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://testnet.monadvision.com" },
    monadscan: { name: "Monadscan", url: "https://testnet.monadscan.com" },
  },
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
  testnet: true,
});

/** Local anvil (pnpm dev:chain). deploy:local installs canonical Multicall3 (anvil has none). */
export const localAnvil = defineChain({
  id: 31_337,
  name: "Local (Anvil)",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
  testnet: true,
});

export const SUPPORTED_CHAINS = [monadTestnet, localAnvil] as const;

export function getChain(chainId: number): Chain {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  if (!chain) throw new Error(`Unsupported chain ${chainId}`);
  return chain;
}

/** Faucets (testnet only). */
export const FAUCETS = {
  mon: "https://faucet.monad.xyz",
  usdc: "https://faucet.circle.com",
} as const;

export function explorerTxUrl(chainId: number, hash: string): string | undefined {
  const url = chainId === monadTestnet.id ? monadTestnet.blockExplorers.default.url : undefined;
  return url ? `${url}/tx/${hash}` : undefined;
}

export function explorerAddressUrl(chainId: number, address: string): string | undefined {
  const url = chainId === monadTestnet.id ? monadTestnet.blockExplorers.default.url : undefined;
  return url ? `${url}/address/${address}` : undefined;
}

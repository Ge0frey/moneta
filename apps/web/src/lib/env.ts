import {
  hasDeployment,
  getDeployment,
  IndexerClient,
  localAnvil,
  monadTestnet,
  type DeploymentRecord,
} from "@moneta/sdk";

/**
 * Public runtime configuration (NEXT_PUBLIC_*; inlined at build). The app targets Monad testnet; the local
 * chain (31337) is for automated tests only (scripts/e2e.sh sets it explicitly).
 */
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? monadTestnet.id);
export const CHAIN = CHAIN_ID === monadTestnet.id ? monadTestnet : localAnvil;
export const RPC_URLS = (process.env.NEXT_PUBLIC_RPC_URLS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
export const INDEXER_URL =
  process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:8081/v1/graphql";
export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";
export const IS_TESTNET = CHAIN_ID === monadTestnet.id;

export const DEPLOYED = hasDeployment(CHAIN_ID);
export const deployment: DeploymentRecord | undefined = DEPLOYED
  ? getDeployment(CHAIN_ID)
  : undefined;
export const indexer = new IndexerClient(INDEXER_URL);

export function requireDeployment(): DeploymentRecord {
  if (!deployment) throw new Error(`Moneta is not deployed on chain ${CHAIN_ID}`);
  return deployment;
}

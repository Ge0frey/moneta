import { deployments, type DeploymentRecord } from "./generated/deployments";

export type { DeploymentRecord };

/** Address book for a chain, from packages/contracts/deployments/<chainId>.json (synced by `pnpm generate`). */
export function getDeployment(chainId: number): DeploymentRecord {
  const d = deployments[chainId];
  if (!d) {
    throw new Error(
      `Moneta is not deployed on chain ${chainId}. Run \`pnpm deploy:local\` (31337) or \`pnpm deploy:testnet\` (10143).`,
    );
  }
  return d;
}

export function hasDeployment(chainId: number): boolean {
  return deployments[chainId] !== undefined;
}

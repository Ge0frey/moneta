import type { Address } from "viem";
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

/** The open-mint test quote: MonetaUSDC deployed as "Moneta Test USDC" (script/TestQuote.s.sol). */
export const TEST_QUOTE_SYMBOL = "mUSDC";
/** What one click of the in-app faucet mints: 10,000 mUSDC. */
export const TEST_QUOTE_MINT = 10_000_000_000n;

export type QuoteAsset = { address: Address; symbol: string; test: boolean };

/**
 * Quote assets a deployment accepts for new raises: the primary quote (Circle USDC on testnet) first, then the
 * test quote when one is deployed. Both are 6-decimal USD stablecoins, so amounts format the same way.
 */
export function quoteAssets(d: DeploymentRecord): QuoteAsset[] {
  return [
    { address: d.quote, symbol: "USDC", test: false },
    ...(d.testQuote ? [{ address: d.testQuote, symbol: TEST_QUOTE_SYMBOL, test: true }] : []),
  ];
}

export function isTestQuote(d: DeploymentRecord | undefined, token: string | undefined): boolean {
  return !!d?.testQuote && !!token && d.testQuote.toLowerCase() === token.toLowerCase();
}

/** Either quote asset (primary or test). */
export function isQuoteAsset(d: DeploymentRecord | undefined, token: string | undefined): boolean {
  return !!d && !!token && (d.quote.toLowerCase() === token.toLowerCase() || isTestQuote(d, token));
}

/** Display symbol of a raise's or project's quote: "mUSDC" for the test quote, "USDC" otherwise. */
export function quoteSymbol(d: DeploymentRecord | undefined, token: string | undefined): string {
  return isTestQuote(d, token) ? TEST_QUOTE_SYMBOL : "USDC";
}

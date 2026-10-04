import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

/** One env file for the whole monorepo: expose the root .env's NEXT_PUBLIC_* values to the web build. */
const rootEnv = join(process.cwd(), "../../.env");
const publicEnv: Record<string, string> = {};
if (existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, "utf8").split("\n")) {
    const m = line.match(/^\s*(NEXT_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]!] === undefined) publicEnv[m[1]!] = m[2]!;
  }
}

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@moneta/sdk"],
  env: publicEnv,
  // WalletConnect pulls optional node-only deps; they are never used in the browser bundle.
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],
  poweredByHeader: false,
  // RainbowKit → @wagmi/connectors (Base Account) → @coinbase/cdp-sdk statically imports optional x402 payment
  // packages Moneta never uses; alias them to a throwing stub instead of shipping unused dependencies.
  turbopack: {
    resolveAlias: {
      "@x402/core/client": "./src/lib/x402-stub.ts",
      "@x402/core/schemas": "./src/lib/x402-stub.ts",
      "@x402/core/server": "./src/lib/x402-stub.ts",
      "@x402/evm": "./src/lib/x402-stub.ts",
      "@x402/evm/auth-capture/client": "./src/lib/x402-stub.ts",
      "@x402/evm/batch-settlement/client": "./src/lib/x402-stub.ts",
      "@x402/evm/exact/client": "./src/lib/x402-stub.ts",
      "@x402/evm/exact/server": "./src/lib/x402-stub.ts",
      "@x402/evm/exact/v1/client": "./src/lib/x402-stub.ts",
      "@x402/evm/upto/client": "./src/lib/x402-stub.ts",
      "@x402/evm/upto/server": "./src/lib/x402-stub.ts",
      "@x402/express": "./src/lib/x402-stub.ts",
      "@x402/extensions/bazaar": "./src/lib/x402-stub.ts",
      "@x402/extensions/builder-code": "./src/lib/x402-stub.ts",
      "@x402/fetch": "./src/lib/x402-stub.ts",
      "@x402/svm/exact/client": "./src/lib/x402-stub.ts",
      "@x402/svm/exact/server": "./src/lib/x402-stub.ts",
      "@x402/svm/exact/v1/client": "./src/lib/x402-stub.ts",
      "@x402/svm/upto/client": "./src/lib/x402-stub.ts",
      "@x402/svm/upto/server": "./src/lib/x402-stub.ts",
    },
  },
};

export default config;

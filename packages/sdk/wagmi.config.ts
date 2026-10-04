import { defineConfig } from "@wagmi/cli";
import { foundry } from "@wagmi/cli/plugins";

/**
 * Generates typed ABIs (`as const`) from the Foundry build of packages/contracts.
 * Run after `forge build` (pnpm generate). Output is committed so consumers don't need Foundry.
 */
export default defineConfig({
  out: "src/generated/abis.ts",
  plugins: [
    foundry({
      project: "../contracts",
      forge: { build: true, rebuild: false },
      include: [
        "MonetaFactory.sol/**",
        "Raise.sol/**",
        "Treasury.sol/**",
        "ProjectToken.sol/**",
        "ConditionalVault.sol/**",
        "ConditionalToken.sol/**",
        "MonetaAMM.sol/**",
        "MonetaRouter.sol/**",
        "MonetaUSDC.sol/**",
      ],
    }),
  ],
});

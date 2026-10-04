# ADR 0007: Quote asset is Circle USDC, behind an allowlist

- **Status:** Accepted
- **Decision:**
  - Raises are denominated in an allowlisted quote token.
  - On Monad testnet that's Circle USDC `0x534b2f3A21130d7a60830c2Df862319e593943A3`: 6 decimals, EIP-2612 permit with domain version "2".
  - Locally, a `MonetaUSDC` with the same interface is deployed.
- **Consequences:** Circle's faucet gives 20 USDC per 2 h per address, so testnet raises are small (tens of USDC). The fork tests run against the real token.

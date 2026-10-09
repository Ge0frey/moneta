# ADR 0007: Quote asset is Circle USDC, behind an allowlist

- **Status:** Accepted (amended 2026-10-09: test quote)
- **Decision:**
  - Raises are denominated in an allowlisted quote token.
  - On Monad testnet that's Circle USDC `0x534b2f3A21130d7a60830c2Df862319e593943A3`: 6 decimals, EIP-2612 permit with domain version "2".
  - Locally, a `MonetaUSDC` with the same interface is deployed.
- **Consequences:** Circle's faucet gives 20 USDC per 2 h per address, so testnet raises are small (tens of USDC). The fork tests run against the real token.

## Amendment: test quote (mUSDC)

- **Context:** Demos, and tests of very large amounts (overflow and underflow edges in raise, treasury and market math), need raises and markets in the thousands of USDC and beyond. At 20 USDC per 2 h, Circle's faucet can't supply that.
- **Decision:**
  - A second quote, `MonetaUSDC` deployed as "Moneta Test USDC" / `mUSDC`, is allowlisted next to Circle USDC on testnet and locally. It has the same interface (6 decimals, permit version "2") and an open `mint`.
  - It is added to a live deployment by `script/TestQuote.s.sol` (`pnpm deploy:test-quote:testnet`), which deploys the token, calls `factory.setQuoteAllowed`, and records it as `testQuote` in `deployments/<chainId>.json`. No protocol contract is redeployed: every raise, treasury, pool and router call already carries its own quote.
  - Circle USDC stays the primary quote (`quote`) and the wizard's default. Founders pick USDC or mUSDC per raise; a raise's quote is fixed at creation.
  - The UI labels every amount with the raise's own quote ("USDC" or "mUSDC"), so the two never look alike. mUSDC mints 10,000 per click from the raise, trade and propose panels and from Portfolio → Test funds.
- **Consequences:**
  - mUSDC has no scarcity: anyone can mint any amount, so mUSDC raise totals and market prices are test figures, not capital. Circle USDC raises keep real testnet scarcity.
  - The protocol's "Total raised" sums both quotes (both are 6-decimal USD units).
  - Never deployed on mainnet. Mainnet uses Circle USDC only.

# ADR 0004: One active proposal + one queued Redemption; USDC bonds

- **Status:** Accepted
- **Decision:**
  - Each project has a single active proposal slot.
  - A Redemption may queue behind a non-redemption active proposal and auto-activates when that proposal finalizes. While it's queued, other proposals revert.
  - Proposers post a USDC bond: refunded on PASS, kept by the treasury on FAIL.
- **Why:** This rules out double-spends between proposals and cross-proposal price interference. Redemption can never be starved, and spam costs money.

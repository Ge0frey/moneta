# ADR 0003: Immutable clones and no swap pause

- **Status:** Accepted
- **Decision:**
  - Every contract is immutable.
  - Per-raise contracts (`Raise`, `ProjectToken`, `Treasury`) are EIP-1167 deterministic clones of immutable implementations.
  - New versions ship as a new factory.
  - The protocol Safe can pause **new raise creation** only, never trading, refunds, claims or redemptions.
- **Why:**
  - Clones keep launch gas low, which matters on Monad, where the gas *limit* is charged.
  - Immutability makes a project's rules credible.
  - A swap pause would let an admin swing verdicts.
- **Consequences:** Exploit response is to pause new raises, warn publicly, and redeploy a fixed factory version.

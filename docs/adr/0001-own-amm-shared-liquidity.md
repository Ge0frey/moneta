# ADR 0001: Own AMM with shared (migrating) liquidity

- **Status:** Accepted (2026-10-04)
- **Context:** Decision markets need depth from the first second, and the spot price must be the welfare metric. Kuru's CLOB can't be run on a local chain, and it can't take treasury liquidity in and out per proposal.
- **Decision:**
  - `MonetaAMM` is a singleton constant-product AMM with owner-only liquidity and a built-in lagging TWAP oracle.
  - At launch, the Treasury seeds the spot pool.
  - When a proposal opens, `proposalLiquidityBps` of that protocol-owned liquidity (POL) is split through the vault into PASS/FAIL pools.
  - After the verdict, the winning reserves are redeemed and re-added to spot.
- **Consequences:** Deep conditional markets, fully local tests and an atomic launch. Third-party LPs and Kuru listing are roadmap items.

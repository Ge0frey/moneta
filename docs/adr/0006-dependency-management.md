# ADR 0006: Dependency management

- **Status:** Accepted
- **Decision:**
  - Solidity dependencies (forge-std, OpenZeppelin 5.6.1 and OpenZeppelin upgradeable 5.6.1) come from **Soldeer**, pinned in `foundry.toml` and `soldeer.lock`.
  - TypeScript dependencies use **pnpm 10** workspaces with Turborepo.
  - Toolchain pins:
    - wagmi 2.x, because RainbowKit 2.x has a peer dependency on wagmi ^2
    - viem 2.x
    - TypeScript 5.9, because TypeScript 7 (the native port) isn't yet supported by Next.js or ESLint tooling
- **Note:** Token clones use OpenZeppelin's *upgradeable* (initializer) variants only because clones can't run constructors. Nothing is upgradeable.

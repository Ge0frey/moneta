# Static analysis and security checks

The bar is zero High or Medium findings, or each one documented as accepted. This file is that record. Every tool is run locally before merging; there is no CI gate.

| Tool | Command | Pass bar |
|---|---|---|
| Slither 0.11.6 | `pnpm --filter @moneta/contracts slither` | Fails on any High |
| Aderyn 0.6.8 | `pnpm --filter @moneta/contracts aderyn` | Report only (`aderyn-report.md`) |
| Gitleaks 8.30.1 | `docker run … ghcr.io/gitleaks/gitleaks:v8.30.1 git /repo --config /repo/.gitleaks.toml` | Fails on any leak (full history) |
| pnpm audit | `pnpm audit --prod --audit-level high` | Fails on High |

## Current results

**Slither:** 0 High after triage. 82 Medium/Low results remain, all reviewed below.

**Aderyn:** 1 High (the same reentrancy pattern as Slither's Medium) and 10 Low, all reviewed below.

**Gitleaks:** no leaks.

**pnpm audit:** 0 High (after the overrides below). The 5 Moderate and 6 Low advisories are in dev-only or transitive paths with no exploitable surface in Moneta.

## Triage

### Fixed

- **Aderyn L-10, unused error `ProposalNotFound`:** removed.

### Accepted

| Finding | Tool / severity | Where | Why it's safe |
|---|---|---|---|
| `uninitialized-state` on `_pools` | Slither High | `MonetaAMM.sol` | It's a mapping, written through `Pool storage` pointers in `createPool` and the liquidity and swap paths. Mappings need no initialization. Annotated inline with `slither-disable-next-line` |
| `reentrancy-no-eth` / "state change after external call" | Slither Medium, Aderyn H-1 | `Treasury` (propose, finalize, execute, redemption), `ConditionalVault` (prepareCollateral, split, merge, redeem), `MonetaFactory.createRaise`, `Raise.finalize` | Every state-changing entry point is `nonReentrant` (OpenZeppelin `ReentrancyGuardTransient`, EIP-1153). External calls go only to Moneta's own immutable contracts (AMM, vault, token clones), the project token, or an allowlisted quote asset. `prepareCollateral` is resolver-only and initializes freshly cloned tokens of Moneta's own implementation. The only arbitrary call, the `Call` action, runs inside `executeAction`, which is `onlySelf` and reached only from `nonReentrant` finalize/execute. A malicious target can't re-enter any guarded function |
| Read-only reentrancy on views (`nav()`, `proposal()`) during a `Call` action | Slither Medium (cross-function) | `Treasury` | A market-approved `Call` target could observe intermediate view values mid-execution. No Moneta contract reads these views to move value. Third-party integrators must not rely on `nav()` inside the same transaction as a proposal execution (documented in `/docs#security`) |
| `divide-before-multiply` | Slither Medium | `LaggingOracle.integral` | Intentional. `reach = d / rate` is the whole number of seconds until the observation converges, which matches the on-chain per-second step semantics. The TypeScript mirror reproduces it bit for bit (80 parity vectors) |
| `incorrect-equality` (`== 0`) | Slither Medium | `Treasury`, `MonetaRouter` | Zero checks on Moneta's own accounting (`launchedAt`, `accrued`, migrated amounts) or the caller's own balances. No attacker-controlled balance can be forced to an exact value to bypass a guard |
| `uninitialized-local` | Slither Medium | `Treasury.propose` (`queued`), `_unwindMarkets`, `_activate`, `MonetaFactory._validateTranches` | Locals that intentionally start at zero/false |
| `unused-return` on `addLiquidity` / `removeLiquidity` | Slither Medium | `Treasury` | Removal at 100% closes the pool. Amounts are measured afterwards by vault redemption and balances, not by the return values |
| `timestamp` | Slither Low | Raise windows, proposal windows, oracle | By design: every window is in seconds. Monad timestamps have 1-second granularity, and a validator's timestamp drift is bounded by consensus |
| Centralization risk | Aderyn L-1 | Factory/AMM admin setters | The Safe can only allowlist quote assets, set fees within hard caps, set bounds for *new* raises, and pause *new* raise creation (ADR 0003). It can't move funds or pause trading |
| Costly operations / `revert` inside loops | Aderyn L-2, L-6 | Tranche and perf validation, tranche amounts at launch | Bounded by `maxTranches` (8) and `maxPerfTranches` (5) |
| Local variable shadows state variable | Aderyn L-5, Slither Low | Factory constructor args struct | Constructor parameter names mirror the immutables they set |
| Address set without zero check | Aderyn L-8, Slither Low | Constructor wiring | Deploy script post-conditions assert every address (`Deploy.s.sol`) |
| Remaining Lows (events-maths, events-access, single-use internal functions, large literals, state change without event, unchecked return) | Aderyn / Slither Low | Various | Reviewed: readability or style only |

### Dependency overrides (root `package.json` → `pnpm.overrides`)

These patch transitive advisories on the same major lines. Nothing in Moneta calls these packages directly.

| Package | Fixed version | Pulled in by |
|---|---|---|
| `body-parser` | ≥ 1.20.3 | `envio` → `express` 4 |
| `path-to-regexp` | ≥ 0.1.13 | `envio` → `express` 4 |
| `ws` | ≥ 8.21.0 | `viem` (via envio and WalletConnect) |

### Secrets policy

`.gitleaks.toml` extends gitleaks' default rules. It allowlists only:
- build and vendor directories
- anvil's publicly documented dev keys (accounts #0, #1, #2, #9), which exist only on local chains
- 20-byte EVM addresses, which are public identifiers

Real keys never touch the repository:
- deployer → encrypted Foundry keystore
- bots → platform secret store

# Moneta

**Permissionless futarchy capital formation on Monad.**

Anyone can open a raise. A successful raise launches three things in one transaction:
- a token
- protocol-owned liquidity
- a treasury that answers to markets

The founder draws a streamed operating budget. Every other dollar leaves the treasury only through a passed proposal. Each proposal opens two decision markets, one pricing the token if it passes and one if it fails, and settles by comparing their lagging TWAPs:

```text
PASS  ⇔  twapPass × 10,000 ≥ twapFail × (10,000 + threshold)
```

- Decisions: [`docs/adr/`](docs/adr)
- Security triage: [`docs/security/static-analysis.md`](docs/security/static-analysis.md)

---

## Repository

```text
apps/
  web/          Next.js 16 app: explore, create wizard, raise, project, proposal trading, portfolio, docs, status
  indexer/      Envio HyperIndex: event-sourced read models served over GraphQL
  bots/         keeper (finalize, crank), belief-driven market makers, watcher (invariants, alerts)
packages/
  contracts/    Foundry: Factory, Raise, ProjectToken, Treasury, ConditionalVault/Token, MonetaAMM, Router
  sdk/          generated ABIs + address book, bit-exact protocol math, action codec, reads, tx pipeline
  config/       shared tsconfig presets
scripts/        dev.sh (local stack), e2e.sh (browser E2E)
docs/           ADRs, security triage, runbooks
```

Dependencies flow one way: `contracts → sdk → {web, bots, indexer}`. The SDK is the only bridge.

## Quickstart

The web app runs on **Monad testnet** against the deployed contracts. The local chain (anvil) is only for automated tests and bot or indexer development, and it has no UI.

**Requirements:**
- Node 24 (`nvm use`)
- pnpm 10 (`corepack enable`)
- [Foundry](https://getfoundry.sh) (`foundryup`)
- Docker (the indexer runs Postgres + Hasura)

```bash
pnpm install
cp .env.example .env        # defaults work as-is; no secrets needed
pnpm dev                    # testnet indexer (Docker, :8081) → web app on Monad testnet
```

Open <http://localhost:3000>. `pnpm dev` checks that the testnet deployment (`packages/contracts/deployments/10143.json`) is live, then reuses or starts the indexer and the web app. The first indexer start builds a Docker image, which takes a few minutes.

To transact, add **Monad Testnet** to your wallet (chain 10143, RPC `https://testnet-rpc.monad.xyz`). Then fund it with MON from [faucet.monad.xyz](https://faucet.monad.xyz) and USDC from [faucet.circle.com](https://faucet.circle.com) (Monad Testnet).

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| GraphQL, testnet (Hasura) | http://localhost:8081/v1/graphql |
| Chain | Monad testnet · chain id 10143 · 300 ms blocks |

### Local test stack

```bash
pnpm dev:local              # anvil → deploy → seed → indexer → bots (no web UI)
```

The local stack is idempotent: it detects a running chain, deployment, seed and indexer and reuses them.
- `pnpm dev:local -- --fresh` restarts from genesis.
- `pnpm dev:local -- --no-bots` skips the bots.
- It serves GraphQL on http://localhost:8080/v1/graphql and the chain on http://127.0.0.1:8545 (chain id 31337, 1 s blocks).
- Logs go to `.dev/*.log`.

`bash scripts/e2e.sh` boots whatever it needs from this stack and builds its own copy of the web app, pinned to the local chain.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | The app on Monad testnet: testnet indexer + web (see above) |
| `pnpm dev:local` | Local test stack, no UI: anvil → deploy → seed → indexer → bots |
| `pnpm dev:indexer:testnet` | Testnet indexer only (Docker Compose, :8081) |
| `pnpm dev:chain` / `deploy:local` / `seed:local` | Individual local stack steps |
| `pnpm dev:web` / `dev:indexer` / `dev:bots` | Run one service (web uses `.env` → testnet; indexer and bots default to local) |
| `pnpm test` | Every unit suite: forge (unit, fuzz 1k, invariant, scenario, adversarial), SDK parity, indexer handlers, bots, web |
| `pnpm typecheck` · `pnpm lint` · `pnpm format:check` | Static checks |
| `pnpm scenario --network local` | Headless full lifecycle through the SDK, with on-chain assertions |
| `bash scripts/e2e.sh` | Browser E2E: builds the web app with a scripted E2E wallet and runs Playwright through the full user journey |
| `pnpm --filter @moneta/indexer parity local` | Indexer ⇄ chain field-by-field parity |
| `pnpm --filter @moneta/contracts gas:check` | Gas budgets (Monad charges the gas *limit*) |
| `pnpm --filter @moneta/contracts slither` / `aderyn` | Static analysis |

## Testing

| Layer | Where | What |
|---|---|---|
| Contracts | `packages/contracts/test` | Unit, fuzz, stateful invariants (vault solvency, AMM backing, router holds nothing), lifecycle scenarios, adversarial (end-of-window pumps, dust spam, reentrant targets), gas budgets, fork tests against Monad testnet |
| SDK | `packages/sdk/test` | Bit-exact parity with forge-generated vectors (CPMath, lagging oracle), action codec, error decoding |
| Indexer | `apps/indexer/test` | Handlers on simulated events (Envio test indexer), plus the parity script against a live chain |
| Bots | `apps/bots/test` | Trader belief math and target sizing |
| Web | `apps/web/src/**/*.test.ts`, `apps/web/e2e` | Wizard validation mirroring `MonetaFactory._validate`, launch math, governance bounds; Playwright E2E |

There is no CI gate on pull requests or pushes: run these locally before merging. The security checks (Slither, Aderyn, Gitleaks, `pnpm audit`) and their commands are listed in [`docs/security/static-analysis.md`](docs/security/static-analysis.md). For deeper runs: `FOUNDRY_PROFILE=deep forge test --no-match-path 'test/fork/*'` in `packages/contracts` (50k fuzz runs, deep invariants) and `pnpm --filter @moneta/contracts test:fork` (fork tests against Monad testnet).

## Monad testnet

| | |
|---|---|
| Chain | 10143 · 300 ms blocks · ~600 ms finality |
| Quote asset | Circle USDC `0x534b2f3A21130d7a60830c2Df862319e593943A3` (6 decimals, EIP-2612 v2) |
| Faucets | MON: [faucet.monad.xyz](https://faucet.monad.xyz) · USDC: [faucet.circle.com](https://faucet.circle.com) |
| Explorers | [MonadVision](https://testnet.monadvision.com) · [Monadscan](https://testnet.monadscan.com) |

Deploying needs an encrypted Foundry keystore. Private keys never go in `.env`.

```bash
cast wallet import moneta-deployer --interactive       # fund it with MON from the faucet
pnpm deploy:testnet                                    # idempotent; writes packages/contracts/deployments/10143.json
pnpm --filter @moneta/contracts verify:testnet         # MonadVision (Sourcify) + Monadscan
pnpm --filter @moneta/bots exec tsx src/index.ts check --network testnet
```

The web app already targets testnet (`NEXT_PUBLIC_CHAIN_ID=10143`), and `pnpm dev` self-hosts the indexer with Docker Compose. Without `ENVIO_API_TOKEN`, it syncs over the RPC; with the token, it uses HyperSync. Envio Cloud is the hosted alternative. Run the bots from the published image with `KEEPER_KEY` / `TRADER_MNEMONIC` set in your platform's secret store. The full checklist is in [`docs/runbooks/testnet-deploy.md`](docs/runbooks/testnet-deploy.md).

## Security model

- **Immutable:** no upgrades. New versions ship as a new factory, and existing projects keep the rules they launched with.
- **Admin can't touch funds:** the protocol Safe can allowlist quote assets, set fees within hard caps, set bounds for *new* raises, and pause *new* raise creation. It can't move funds, change a live project, or pause trading.
- **Exits always open:** refunds, claims, merges, conditional redemptions and NAV redemptions can't be blocked.
- **Indexer is never authoritative:** every gate and amount in the UI is read from the chain. The indexer serves only lists and history.

See [`/docs#security`](apps/web/src/app/docs/page.tsx) in the app and the [static-analysis triage](docs/security/static-analysis.md).

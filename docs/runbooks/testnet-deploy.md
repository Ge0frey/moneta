# Runbook: deploy Moneta to Monad testnet

Every step is idempotent: re-running after a failure, or after a testnet reset, resumes from on-chain state.

## 0. Prerequisites

| What | How |
|---|---|
| Deployer keystore | `cast wallet import moneta-deployer --interactive`. The key is encrypted on disk and never goes in `.env` |
| Deployer MON | [faucet.monad.xyz](https://faucet.monad.xyz). Keep at least 10 MON (Monad's reserve balance) plus gas |
| Protocol Safe (optional, recommended) | Safe 1.4.1 on Monad testnet. Put its address in `PROTOCOL_SAFE`. Without it, the deployer stays owner |
| Fee recipient | `FEE_RECIPIENT` (defaults to the deployer) |
| Monadscan API key (optional) | `MONADSCAN_API_KEY` for the second explorer |
| Keeper and trader wallets | Separate EOAs. Fund each with MON. Fund traders with Circle USDC ([faucet.circle.com](https://faucet.circle.com), 20 USDC / 2 h / address) |
| Envio API token | [envio.dev/app/api-tokens](https://envio.dev/app/api-tokens), for HyperSync |

## 1. Contracts

```bash
pnpm deploy:testnet          # forge script with --account moneta-deployer, gas ×1.15; writes deployments/10143.json
pnpm --filter @moneta/contracts verify:testnet
```

The deploy script asserts its post-conditions (wiring, allowlist, bounds, owners). With `PROTOCOL_SAFE` set, ownership is offered to the Safe (Ownable2Step). **Accept it from the Safe UI** for both `MonetaFactory` and `MonetaAMM`.

`pnpm deploy:testnet` also regenerates `packages/sdk/src/generated/deployments.ts`. Commit it along with `deployments/10143.json`.

## 2. Smoke

```bash
pnpm --filter @moneta/bots exec tsx src/index.ts check --network testnet   # wiring + invariants, no transactions
pnpm --filter @moneta/bots exec tsx src/index.ts scenario --network testnet # full story with small USDC amounts
```

## 3. Indexer

**Envio Cloud (preferred):**
1. Connect the repo.
2. Set the indexer directory to `apps/indexer`.
3. Set the build command to `pnpm gen-config testnet && pnpm codegen`.
4. Add `ENVIO_API_TOKEN`.

**Self-hosted:**

```bash
INDEXER_NETWORK=testnet ENVIO_API_TOKEN=… docker compose up -d postgres hasura indexer   # GraphQL on :8081
```

Check parity once it's synced:

```bash
INDEXER_URL=<graphql url> pnpm --filter @moneta/indexer parity testnet
```

## 4. Bots

Build the image with `docker build -f apps/bots/Dockerfile -t moneta-bots .` from the repo root (or `docker compose --profile bots up -d bots`) and run it with:

| Env | Value |
|---|---|
| `RPC_URL` | Keyed Monad testnet RPC (public RPC as fallback) |
| `INDEXER_URL` | The indexer's GraphQL URL |
| `KEEPER_KEY` | Keeper EOA (secret store) |
| `TRADER_MNEMONIC` | Market-maker bots (secret store, testnet only) |
| `ALERT_WEBHOOK_URL` | Discord webhook for watcher alerts |

Command: `all --network testnet` (or `keeper --network testnet` for staging).

## 5. Web (Vercel)

| Env | Value |
|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | `10143` |
| `NEXT_PUBLIC_RPC_URLS` | Keyed, domain-restricted RPC first, then `https://testnet-rpc.monad.xyz` |
| `NEXT_PUBLIC_INDEXER_URL` | Indexer GraphQL URL |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Reown project id |

Set the root directory to `apps/web`, keep the framework preset on Next.js, and leave the install command as the default (pnpm workspace).

## 6. Open the first raise

```bash
pnpm seed:testnet
```

Or use the app's **Create** wizard from a funded wallet. Watch `/status`: the keeper should finalize raises and proposals within 60 s of their end.

## Testnet reset

If the chain is reset from genesis, re-run steps 1–6. `deploy.sh` notices the previous deployment has no code and redeploys.

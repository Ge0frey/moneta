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

**Envio Cloud (preferred):** it uploads only `apps/indexer`, so the indexer is self-contained there. Its config is the committed `config.cloud.yaml` (HyperSync), and the ABIs are copied into `abis/`.
1. Connect the repo with Indexer Directory `apps/indexer`, Config File `config.cloud.yaml` (relative to the Indexer Directory) and Git Release Branch `envio`. Keep public visibility on, because the browser app queries the endpoint without credentials.
2. Under Settings → Environment Variables, add `ENVIO_API_TOKEN`. The docs don't say whether Envio Cloud supplies HyperSync access itself, so set it to be safe.
3. Deploy with `git push origin main:envio`. Each push to `envio` creates a new deployment, which re-indexes from the start block. An indexer can hold only 3 deployments. Once it has 3, a push doesn't deploy: delete an old deployment, then deploy the commit from **Recent Commits**.
4. After a contract redeploy, run `pnpm --filter @moneta/indexer gen-config cloud`, commit `config.cloud.yaml` and `abis/`, and push to `envio`.
5. Set the web app's `NEXT_PUBLIC_INDEXER_URL` to the deployment's endpoint (`https://indexer.dev.hyperindex.xyz/<id>/v1/graphql`, shown on the deployment page). The Development plan has no static production endpoint, because Promote to Production is paid-only. So **every new deployment has a new URL**: update the Vercel environment variable, redeploy the web app, then delete the old deployment.

On the free Development plan, Envio deletes a deployment after 30 days or above 20 GB. It also starts deletion (7 days of grace, then 3 days read-only) after 100k events, 5 GB, or 7 days with no queries. Query rate limits depend on the plan. If the app gets HTTP 429s, reduce the polling in `apps/web/src/lib/hooks/indexed.ts` or upgrade.

**Self-hosted:**

```bash
pnpm dev:indexer:testnet    # docker compose up -d --build postgres hasura indexer; GraphQL on :8081
```

With `ENVIO_API_TOKEN` set, it syncs through HyperSync. Without it, it syncs over `MONAD_TESTNET_RPC_URL`, in 100-block `eth_getLogs` ranges (the public RPC's cap). `pnpm dev` starts the indexer and then the web app.

Check parity once it's synced:

```bash
INDEXER_URL=<graphql url> pnpm --filter @moneta/sdk parity testnet
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

The Vercel project `moneta` deploys `apps/web` from GitHub on every push to `main`. Set it up from the repo root:

```bash
vercel link --yes --project moneta
vercel project update moneta --root-directory apps/web --framework nextjs --node-version 24.x
vercel git connect
```

| Setting | Value |
|---|---|
| Root Directory | `apps/web` |
| Framework | Next.js |
| Install / Build command | Defaults. Vercel detects pnpm from the root lockfile and installs the workspace. Don't override the install command, because an override makes Vercel use its oldest pnpm |

Set these environment variables for Production and Preview (`vercel env add <NAME> production`). `NEXT_PUBLIC_*` values are inlined at build time, so redeploy after changing them:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_INDEXER_URL` | The Envio deployment endpoint. It changes with every Envio deployment (see step 3) |
| `NEXT_PUBLIC_CHAIN_ID` | `10143` (also the default) |
| `NEXT_PUBLIC_RPC_URLS` | Optional: a keyed, domain-restricted RPC first. Defaults to the public testnet RPCs |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional: Reown project id, which enables WalletConnect/mobile wallets |

Prefer Git deploys. `vercel deploy` uploads the local working tree, and `.vercelignore` keeps `.env` and local artifacts out of that upload.

## 6. Open the first raise

```bash
pnpm seed:testnet
```

Or use the app's **Create** wizard from a funded wallet. Watch `/status`: the keeper should finalize raises and proposals within 60 s of their end.

## Testnet reset

If the chain is reset from genesis, re-run steps 1–6. `deploy.sh` notices the previous deployment has no code and redeploys.

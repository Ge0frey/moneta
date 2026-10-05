#!/usr/bin/env bash
# Moneta dev environments. The web UI only ever runs against Monad testnet; the local chain is for tests.
#   pnpm dev                       the app on Monad testnet: testnet indexer (Docker, :8081) → web (:3000)
#   pnpm dev:local                 local test stack, no UI: anvil → deploy → seed → indexer (:8080) → bots
#   pnpm dev:local -- --no-bots    skip keeper/traders/watcher
#   pnpm dev:local -- --fresh      restart anvil from genesis, redeploy and reseed
# Logs: .dev/*.log. Re-running is safe: every step detects what's already up.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOGS="$ROOT/.dev"
mkdir -p "$LOGS"

LOCAL=0
BOTS=1
FRESH=0
for a in "$@"; do
  case "$a" in
    --local) LOCAL=1 ;;
    --no-bots) BOTS=0 ;;
    --fresh) FRESH=1 ;;
    --) ;;
    *) echo "unknown flag: $a" >&2; exit 1 ;;
  esac
done

PIDS=()
say() { printf "\033[1m%s\033[0m %s\n" "$1" "$2"; }

cleanup() {
  [ ${#PIDS[@]} -eq 0 ] && return
  say "■" "stopping ${#PIDS[@]} process(es) (indexer containers stay up)"
  for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

need() { command -v "$1" >/dev/null || { echo "✗ missing '$1' — $2" >&2; exit 1; }; }
need node "install Node 24 (nvm use)"
need pnpm "corepack enable"
need cast "install Foundry (foundryup)"
need docker "install Docker (the indexer runs Postgres + Hasura)"

wait_for() { # <label> <seconds> <command...>
  local label=$1 secs=$2; shift 2
  for _ in $(seq 1 "$secs"); do "$@" >/dev/null 2>&1 && return 0; sleep 1; done
  echo "✗ timed out waiting for $label" >&2
  exit 1
}
indexer_ready() { curl -sf "$1" -H 'content-type: application/json' -d '{"query":"{ _meta { isReady } }"}' | grep -q '"isReady":true'; }

# ═════════════════════════════ pnpm dev: the app on Monad testnet ═════════════════════════════
if [ "$LOCAL" = 0 ]; then
  [ "$BOTS$FRESH" = 10 ] || { echo "✗ --no-bots/--fresh apply to the local stack: pnpm dev:local -- …" >&2; exit 1; }
  RPC="${MONAD_TESTNET_RPC_URL:-https://testnet-rpc.monad.xyz}"
  GQL="http://localhost:${HASURA_PORT:-8081}/v1/graphql"
  DEPLOYMENT=packages/contracts/deployments/10143.json

  # ── 1. deployment ────────────────────────────────────────────────────────
  [ -f "$DEPLOYMENT" ] || { echo "✗ no $DEPLOYMENT — deploy first: pnpm deploy:testnet" >&2; exit 1; }
  FACTORY=$(node -e "console.log(require('./$DEPLOYMENT').factory)")
  [ "$(cast code "$FACTORY" --rpc-url "$RPC" 2>/dev/null || echo 0x)" != "0x" ] \
    || { echo "✗ factory $FACTORY has no code on testnet (reset?) — redeploy: pnpm deploy:testnet" >&2; exit 1; }
  say "✓" "Moneta on Monad testnet (factory $FACTORY)"

  # ── 2. indexer (self-hosted, side by side with the local one on :8080) ──
  if indexer_ready "$GQL"; then
    say "✓" "testnet indexer already serving $GQL"
  else
    say "▶" "testnet indexer (Docker: Postgres + Hasura + Envio) → .dev/indexer-testnet.log"
    INDEXER_NETWORK=testnet docker compose up -d --build postgres hasura indexer >"$LOGS/indexer-testnet.log" 2>&1 \
      || { tail -30 "$LOGS/indexer-testnet.log"; exit 1; }
    wait_for "testnet indexer at $GQL (docker compose logs indexer)" 300 indexer_ready "$GQL"
  fi

  # ── 3. web ───────────────────────────────────────────────────────────────
  if curl -sf -o /dev/null http://localhost:3000/docs; then
    say "✓" "web already serving http://localhost:3000 (restart it if it was started for another chain)"
  else
    say "▶" "web → http://localhost:3000 (.dev/web.log)"
    (cd apps/web && NEXT_PUBLIC_CHAIN_ID=10143 NEXT_PUBLIC_INDEXER_URL="$GQL" pnpm --silent dev) >"$LOGS/web.log" 2>&1 &
    PIDS+=($!)
    wait_for "web on :3000" 120 curl -sf -o /dev/null http://localhost:3000/docs
  fi

  cat <<EOF

  Moneta is running on Monad testnet
  ──────────────────────────────────
  App        http://localhost:3000
  GraphQL    $GQL
  Chain      Monad testnet (10143) · factory $FACTORY
  Logs       .dev/web.log · docker compose logs -f indexer

  Wallet: add Monad Testnet (chain 10143, RPC https://testnet-rpc.monad.xyz) and fund it with
  MON (https://faucet.monad.xyz) and USDC (https://faucet.circle.com → Monad Testnet).
  Ctrl-C stops the web app; 'docker compose stop indexer hasura postgres' stops the indexer.
EOF
  wait
  exit 0
fi

# ═════════════════════════════ pnpm dev:local: local test stack (no UI) ═════════════════════════
need anvil "install Foundry (foundryup)"
need forge "install Foundry (foundryup)"
RPC="http://127.0.0.1:8545"
GQL="http://localhost:8080/v1/graphql"

# ── 1. chain ─────────────────────────────────────────────────────────────────
if [ "$FRESH" = 1 ]; then
  # A new chain invalidates everything derived from the old one: the deployment and the indexer's database.
  say "•" "--fresh: stopping anvil, bots and the dev indexer"
  pkill -x anvil 2>/dev/null || true
  pkill -f "[s]rc/index.ts (all|keeper|traders|watcher)" 2>/dev/null || true
  pkill -f "[e]nvio/bin.mjs dev" 2>/dev/null || true
  (cd apps/indexer && pnpm --silent exec envio stop >/dev/null 2>&1) || true
  sleep 1
fi
if cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then
  say "✓" "anvil already running at $RPC"
else
  say "▶" "anvil (chain 31337, 1s blocks, 128KB code limit) → .dev/anvil.log"
  anvil --chain-id 31337 --block-time 1 --host 0.0.0.0 --code-size-limit 131072 >"$LOGS/anvil.log" 2>&1 &
  PIDS+=($!)
  wait_for anvil 30 cast chain-id --rpc-url "$RPC"
fi

# ── 2. contracts ─────────────────────────────────────────────────────────────
[ -d packages/contracts/dependencies ] || pnpm contracts:deps
say "▶" "deploy (idempotent)"
pnpm --silent deploy:local

# ── 3. seed (only a fresh deployment has no raises) ─────────────────────────
FACTORY=$(node -e "console.log(require('./packages/contracts/deployments/31337.json').factory)")
RAISES=$(cast call "$FACTORY" "raiseCount()(uint256)" --rpc-url "$RPC")
if [ "$RAISES" = "0" ]; then
  say "▶" "seed: raises in every lifecycle state → .dev/seed.log"
  pnpm --silent seed:local >"$LOGS/seed.log" 2>&1 || { tail -20 "$LOGS/seed.log"; exit 1; }
else
  say "✓" "already seeded ($RAISES raises)"
fi

# ── 4. indexer ───────────────────────────────────────────────────────────────
if indexer_ready "$GQL"; then
  say "✓" "indexer already serving $GQL"
else
  say "▶" "indexer (Envio dev: Postgres + Hasura in Docker) → .dev/indexer.log"
  (cd apps/indexer && INDEXER_NETWORK=local pnpm --silent dev) >"$LOGS/indexer.log" 2>&1 &
  PIDS+=($!)
  wait_for "indexer at $GQL" 240 indexer_ready "$GQL"
fi

# ── 5. bots ──────────────────────────────────────────────────────────────────
if [ "$BOTS" = 1 ] && pgrep -f "[s]rc/index.ts (all|keeper)" >/dev/null; then
  say "✓" "bots already running"
elif [ "$BOTS" = 1 ]; then
  say "▶" "bots: keeper + market makers + watcher → .dev/bots.log"
  (cd apps/bots && pnpm --silent exec tsx src/index.ts all --network local) >"$LOGS/bots.log" 2>&1 &
  PIDS+=($!)
fi

cat <<EOF

  Local test stack is running (no web UI — the app runs on testnet: pnpm dev)
  ─────────────────────────────────────────────────────────────────────────────
  GraphQL    $GQL
  Chain      $RPC (31337)
  Logs       .dev/{anvil,indexer,bots}.log

  Use it for: bash scripts/e2e.sh · pnpm --filter @moneta/sdk parity local · bot development.
  Ctrl-C to stop.
EOF
wait

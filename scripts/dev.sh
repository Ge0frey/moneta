#!/usr/bin/env bash
# One-command local stack: anvil → deploy → seed → indexer → bots → web.
#   pnpm dev                 everything (Ctrl-C stops the processes this script started)
#   pnpm dev -- --no-bots    skip keeper/traders/watcher
#   pnpm dev -- --fresh      restart anvil from genesis, redeploy and reseed
# Logs: .dev/*.log. Re-running is safe: every step detects what's already up.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOGS="$ROOT/.dev"
mkdir -p "$LOGS"

BOTS=1
FRESH=0
for a in "$@"; do
  case "$a" in
    --no-bots) BOTS=0 ;;
    --fresh) FRESH=1 ;;
    --) ;;
    *) echo "unknown flag: $a" >&2; exit 1 ;;
  esac
done

RPC="http://127.0.0.1:8545"
GQL="http://localhost:8080/v1/graphql"
PIDS=()
say() { printf "\033[1m%s\033[0m %s\n" "$1" "$2"; }

cleanup() {
  [ ${#PIDS[@]} -eq 0 ] && return
  say "■" "stopping ${#PIDS[@]} process(es) (indexer containers stay up; 'pnpm --filter @moneta/indexer stop' removes them)"
  for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

need() { command -v "$1" >/dev/null || { echo "✗ missing '$1' — $2" >&2; exit 1; }; }
need node "install Node 24 (nvm use)"
need pnpm "corepack enable"
need anvil "install Foundry (foundryup)"
need forge "install Foundry (foundryup)"
need docker "install Docker (the indexer runs Postgres + Hasura)"

wait_for() { # <label> <seconds> <command...>
  local label=$1 secs=$2; shift 2
  for _ in $(seq 1 "$secs"); do "$@" >/dev/null 2>&1 && return 0; sleep 1; done
  echo "✗ timed out waiting for $label" >&2
  exit 1
}

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
indexer_ready() { curl -sf "$GQL" -H 'content-type: application/json' -d '{"query":"{ _meta { isReady } }"}' | grep -q '"isReady":true'; }
if indexer_ready; then
  say "✓" "indexer already serving $GQL"
else
  say "▶" "indexer (Envio dev: Postgres + Hasura in Docker) → .dev/indexer.log"
  (cd apps/indexer && INDEXER_NETWORK=local pnpm --silent dev) >"$LOGS/indexer.log" 2>&1 &
  PIDS+=($!)
  wait_for "indexer at $GQL" 240 indexer_ready
fi

# ── 5. bots ──────────────────────────────────────────────────────────────────
if [ "$BOTS" = 1 ] && pgrep -f "[s]rc/index.ts (all|keeper)" >/dev/null; then
  say "✓" "bots already running"
elif [ "$BOTS" = 1 ]; then
  say "▶" "bots: keeper + market makers + watcher → .dev/bots.log"
  (cd apps/bots && pnpm --silent exec tsx src/index.ts all --network local) >"$LOGS/bots.log" 2>&1 &
  PIDS+=($!)
fi

# ── 6. web ───────────────────────────────────────────────────────────────────
if curl -sf -o /dev/null http://localhost:3000/docs; then
  say "✓" "web already serving http://localhost:3000"
else
  say "▶" "web → http://localhost:3000 (.dev/web.log)"
  (cd apps/web && pnpm --silent dev) >"$LOGS/web.log" 2>&1 &
  PIDS+=($!)
  wait_for "web on :3000" 120 curl -sf -o /dev/null http://localhost:3000/docs
fi

cat <<EOF

  Moneta is running locally
  ─────────────────────────
  App        http://localhost:3000
  GraphQL    $GQL
  Chain      $RPC (31337)
  Logs       .dev/{anvil,indexer,bots,web}.log

  Wallet: import an anvil dev key into your browser wallet and add network 31337 → $RPC.
  Ctrl-C to stop.
EOF
wait

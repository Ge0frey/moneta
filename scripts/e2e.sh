#!/usr/bin/env bash
# Browser E2E against a local stack. Used by CI and runnable locally:
#   bash scripts/e2e.sh            boot what's missing (anvil, deploy, indexer, keeper), build + start the web app
#                                  with the scripted E2E wallet, fund it, run Playwright
# The E2E wallet is anvil dev account #9 — a public test key that only ever exists on local chains.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOGS="$ROOT/.dev"
mkdir -p "$LOGS"

RPC="http://127.0.0.1:8545"
GQL="http://localhost:8080/v1/graphql"
E2E_KEY=0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6
E2E_ADDR=0xa0Ee7A142d267C1f36714E4a8F75612F20a79720
PORT="${E2E_PORT:-3100}"
PIDS=()
trap 'for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done' EXIT INT TERM

wait_for() {
  local label=$1 secs=$2; shift 2
  for _ in $(seq 1 "$secs"); do "$@" >/dev/null 2>&1 && return 0; sleep 1; done
  echo "✗ timed out waiting for $label" >&2
  for f in "$LOGS"/*.log; do echo "── $f"; tail -30 "$f"; done
  exit 1
}

if ! cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then
  anvil --chain-id 31337 --block-time 1 --host 0.0.0.0 --code-size-limit 131072 >"$LOGS/anvil.log" 2>&1 &
  PIDS+=($!)
  wait_for anvil 30 cast chain-id --rpc-url "$RPC"
fi
pnpm --silent deploy:local

indexer_ready() { curl -sf "$GQL" -H 'content-type: application/json' -d '{"query":"{ _meta { isReady } }"}' | grep -q '"isReady":true'; }
if ! indexer_ready; then
  (cd apps/indexer && INDEXER_NETWORK=local pnpm --silent dev) >"$LOGS/indexer.log" 2>&1 &
  PIDS+=($!)
  wait_for indexer 300 indexer_ready
fi

# Keeper only: deterministic markets (the test also finalizes itself if the keeper is slow).
if ! pgrep -f "[s]rc/index.ts (all|keeper)" >/dev/null; then
  (cd apps/bots && pnpm --silent exec tsx src/index.ts keeper --network local) >"$LOGS/keeper.log" 2>&1 &
  PIDS+=($!)
fi

QUOTE=$(node -e "console.log(require('./packages/contracts/deployments/31337.json').quote)")
cast send "$QUOTE" "mint(address,uint256)" "$E2E_ADDR" 1000000000 --private-key "$E2E_KEY" --rpc-url "$RPC" >/dev/null
echo "✓ E2E wallet $E2E_ADDR funded with 1,000 MonetaUSDC"

if [ -z "${E2E_BASE_URL:-}" ]; then
  (cd apps/web && NEXT_PUBLIC_E2E_KEY=$E2E_KEY pnpm --silent exec next build && NEXT_PUBLIC_E2E_KEY=$E2E_KEY pnpm --silent exec next start --port "$PORT") >"$LOGS/web-e2e.log" 2>&1 &
  PIDS+=($!)
  wait_for "web on :$PORT" 600 curl -sf -o /dev/null "http://localhost:$PORT/docs"
  export E2E_BASE_URL="http://localhost:$PORT"
fi

cd apps/web && pnpm --silent exec playwright test "$@"

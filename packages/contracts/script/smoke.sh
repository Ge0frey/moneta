#!/usr/bin/env bash
# End-to-end smoke test on a live local anvil node (pnpm dev:chain + deploy:local first).
set -euo pipefail
cd "$(dirname "$0")/.."
RPC="${LOCAL_RPC_URL:-http://127.0.0.1:8545}"
run() { forge script script/Smoke.s.sol:Smoke --sig "$1()" --rpc-url "$RPC" --broadcast --slow 2>&1 | grep -E "phase[0-9]:|SMOKE|Error|revert|failed" || true; }
advance() { cast rpc evm_increaseTime "$1" --rpc-url "$RPC" >/dev/null; cast rpc evm_mine --rpc-url "$RPC" >/dev/null; }

run phase1
advance 100
run phase2
advance 260
run phase3

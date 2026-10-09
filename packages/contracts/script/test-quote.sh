#!/usr/bin/env bash
# Add the open-mint test quote (mUSDC) to a live Moneta deployment. Usage: script/test-quote.sh <local|testnet>
#   local   → anvil dev key (deploy.sh local runs this automatically)
#   testnet → encrypted Foundry keystore ($DEPLOYER_ACCOUNT), which must own the factory
# Deploys no protocol contract. Idempotent: reuses the recorded testQuote and skips the allowlist call when done.
set -euo pipefail
cd "$(dirname "$0")/.."

NETWORK="${1:-local}"
ROOT_ENV="../../.env"
# shellcheck disable=SC1090
[ -f "$ROOT_ENV" ] && set -a && source "$ROOT_ENV" && set +a

case "$NETWORK" in
  local)
    RPC="${LOCAL_RPC_URL:-http://127.0.0.1:8545}"
    CHAIN_ID=31337
    # anvil's well-known dev account #0 — local only, never funded anywhere real
    AUTH=(--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
    ;;
  testnet)
    RPC="${MONAD_TESTNET_RPC_URL:-https://testnet-rpc.monad.xyz}"
    CHAIN_ID=10143
    : "${DEPLOYER_ACCOUNT:?set DEPLOYER_ACCOUNT (cast wallet import <name> --interactive)}"
    AUTH=(--account "$DEPLOYER_ACCOUNT" --slow --gas-estimate-multiplier 115)
    ;;
  *) echo "unknown network: $NETWORK" >&2; exit 1 ;;
esac

if ! cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then
  echo "✗ RPC not reachable: $RPC (local: run 'pnpm dev:chain')" >&2
  exit 1
fi

DEPLOYMENT="deployments/${CHAIN_ID}.json"
[ -f "$DEPLOYMENT" ] || { echo "✗ no $DEPLOYMENT — deploy Moneta first" >&2; exit 1; }
FACTORY=$(python3 -c "import json;print(json.load(open('$DEPLOYMENT'))['factory'])")
TEST_QUOTE=$(python3 -c "import json;print(json.load(open('$DEPLOYMENT')).get('testQuote',''))")

# Already done? Skip the broadcast (and the keystore password prompt).
if [ -n "$TEST_QUOTE" ] && [ "$(cast code "$TEST_QUOTE" --rpc-url "$RPC" 2>/dev/null || echo 0x)" != "0x" ] \
  && [ "$(cast call "$FACTORY" "quoteAllowed(address)(bool)" "$TEST_QUOTE" --rpc-url "$RPC")" = "true" ]; then
  echo "✓ Test quote (mUSDC) already live and allowlisted on chain $CHAIN_ID at $TEST_QUOTE"
  exit 0
fi

forge script script/TestQuote.s.sol:TestQuote --rpc-url "$RPC" --broadcast "${AUTH[@]}"
echo "✓ testQuote written to packages/contracts/$DEPLOYMENT"

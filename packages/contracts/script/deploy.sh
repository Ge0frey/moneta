#!/usr/bin/env bash
# Deploy Moneta. Usage: script/deploy.sh <local|testnet> [--force]
#   local   → anvil (pnpm dev:chain), anvil dev key, MonetaUSDC auto-deployed, plus the mUSDC test quote
#   testnet → Monad testnet (10143), encrypted Foundry keystore ($DEPLOYER_ACCOUNT), Circle USDC
#             (add the mUSDC test quote with script/test-quote.sh testnet)
# Idempotent: refuses to redeploy over a live deployment unless --force (a testnet reset wipes code → redeploys).
set -euo pipefail
cd "$(dirname "$0")/.."

NETWORK="${1:-local}"
FORCE="${2:-}"
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
    export QUOTE_TOKEN="${QUOTE_TOKEN_TESTNET:-0x534b2f3A21130d7a60830c2Df862319e593943A3}"
    AUTH=(--account "$DEPLOYER_ACCOUNT" --slow --gas-estimate-multiplier 115)
    ;;
  *) echo "unknown network: $NETWORK" >&2; exit 1 ;;
esac

if ! cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then
  echo "✗ RPC not reachable: $RPC (local: run 'pnpm dev:chain')" >&2
  exit 1
fi

if [ "$NETWORK" = local ]; then
  # Anvil has no Multicall3; install the canonical runtime (snapshot from Monad testnet) at its canonical address
  MC3=0xcA11bde05977b3631167028862bE2a173976CA11
  if [ "$(cast code $MC3 --rpc-url "$RPC")" = "0x" ]; then
    cast rpc anvil_setCode "$MC3" "$(cat script/multicall3.runtime.hex)" --rpc-url "$RPC" >/dev/null
    echo "• Multicall3 installed at $MC3"
  fi
fi

DEPLOYMENT="deployments/${CHAIN_ID}.json"
if [ -f "$DEPLOYMENT" ] && [ "$FORCE" != "--force" ]; then
  FACTORY=$(python3 -c "import json;print(json.load(open('$DEPLOYMENT'))['factory'])")
  CODE=$(cast code "$FACTORY" --rpc-url "$RPC" 2>/dev/null || echo 0x)
  if [ "$CODE" != "0x" ]; then
    echo "✓ Moneta already live on chain $CHAIN_ID at factory $FACTORY (use --force to redeploy)"
    if [ "$NETWORK" = local ]; then bash script/test-quote.sh local; fi
    exit 0
  fi
  echo "• Previous deployment has no code (chain reset?) — redeploying"
fi

mkdir -p deployments
NETWORK="$NETWORK" forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC" --broadcast "${AUTH[@]}"
echo "✓ Deployment written to packages/contracts/$DEPLOYMENT"
if [ "$NETWORK" = local ]; then bash script/test-quote.sh local; fi

#!/usr/bin/env bash
# Verify every Moneta contract on Monad testnet explorers:
#   MonadVision (Sourcify, no key) and Monadscan (Etherscan-compatible, needs MONADSCAN_API_KEY).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT_ENV="../../.env"
# shellcheck disable=SC1090
[ -f "$ROOT_ENV" ] && set -a && source "$ROOT_ENV" && set +a

CHAIN_ID=10143
DEPLOYMENT="deployments/${CHAIN_ID}.json"
[ -f "$DEPLOYMENT" ] || { echo "no $DEPLOYMENT — deploy first" >&2; exit 1; }
j() { python3 -c "import json;print(json.load(open('$DEPLOYMENT'))['$1'])"; }

AMM=$(j amm); VAULT=$(j vault); ROUTER=$(j router); FACTORY=$(j factory)
CT_IMPL=$(j conditionalTokenImpl); PT_IMPL=$(j projectTokenImpl); T_IMPL=$(j treasuryImpl); R_IMPL=$(j raiseImpl)
DEPLOYER=$(j deployer); FEE_RECIPIENT="${FEE_RECIPIENT:-$DEPLOYER}"

verify() { # address contract [constructor-args]
  local addr="$1" name="$2" args="${3:-}"
  local extra=()
  [ -n "$args" ] && extra=(--constructor-args "$args")
  echo "→ $name @ $addr"
  forge verify-contract "$addr" "$name" --chain "$CHAIN_ID" \
    --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/ "${extra[@]}" || true
  if [ -n "${MONADSCAN_API_KEY:-}" ]; then
    forge verify-contract "$addr" "$name" --chain "$CHAIN_ID" \
      --verifier etherscan --etherscan-api-key "$MONADSCAN_API_KEY" --watch "${extra[@]}" || true
  fi
}

verify "$AMM" src/MonetaAMM.sol:MonetaAMM "$(cast abi-encode 'c(address,address,uint16)' "$DEPLOYER" "$FEE_RECIPIENT" 3333)"
verify "$CT_IMPL" src/ConditionalToken.sol:ConditionalToken
verify "$VAULT" src/ConditionalVault.sol:ConditionalVault "$(cast abi-encode 'c(address)' "$CT_IMPL")"
verify "$PT_IMPL" src/ProjectToken.sol:ProjectToken
verify "$T_IMPL" src/Treasury.sol:Treasury
verify "$R_IMPL" src/Raise.sol:Raise
verify "$ROUTER" src/MonetaRouter.sol:MonetaRouter "$(cast abi-encode 'c(address,address,address)' "$FACTORY" "$VAULT" "$AMM")"
# The factory takes a struct; Sourcify matches on creation bytecode + metadata, so we let it guess args.
verify "$FACTORY" src/MonetaFactory.sol:MonetaFactory
echo "✓ verification submitted (clones of the impls are auto-recognised as EIP-1167 proxies)"

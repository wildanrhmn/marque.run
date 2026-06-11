#!/usr/bin/env bash
set -euo pipefail

# Deploy MarquePiece to Base mainnet using the broker float wallet.
# Reads BROKER_FLOAT_PRIVATE_KEY from apps/broker/.env (chmod 600).
# Owner of the contract defaults to the broker float address; override with DEPLOY_OWNER env.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${REPO_ROOT}/apps/broker/.env"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "broker .env not readable at $ENV_FILE" >&2
  exit 1
fi

DEPLOYER_PRIVATE_KEY=$(grep '^BROKER_FLOAT_PRIVATE_KEY=' "$ENV_FILE" | cut -d= -f2-)
DEPLOY_OWNER=${DEPLOY_OWNER:-$(grep '^BROKER_FLOAT_ADDRESS=' "$ENV_FILE" | cut -d= -f2-)}

if [[ -z "$DEPLOYER_PRIVATE_KEY" ]]; then
  echo "BROKER_FLOAT_PRIVATE_KEY missing from $ENV_FILE" >&2
  exit 1
fi

RPC_URL=${BASE_RPC_URL:-https://mainnet.base.org}

export PATH="$HOME/.foundry/bin:$PATH"

cd "$REPO_ROOT/contracts"

echo "==> compiling"
forge build

echo "==> checking deployer balance"
DEPLOYER_ADDR=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
BAL_WEI=$(cast balance --rpc-url "$RPC_URL" "$DEPLOYER_ADDR")
echo "deployer: $DEPLOYER_ADDR"
echo "balance:  $BAL_WEI wei"
BAL_ETH=$(cast from-wei "$BAL_WEI")
echo "balance:  $BAL_ETH ETH"

MIN_WEI="500000000000000"
if (( $(echo "$BAL_WEI < $MIN_WEI" | bc -l 2>/dev/null || echo "1") )); then
  if [[ "$BAL_WEI" -lt 500000000000000 ]]; then
    echo "insufficient ETH (need >=0.0005 ETH for deploy)" >&2
    exit 1
  fi
fi

echo "==> broadcasting deployment"
DEPLOYER_PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY" DEPLOY_OWNER="$DEPLOY_OWNER" \
  forge script script/Deploy.s.sol:DeployMarquePiece \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --slow \
  2>&1 | tee /tmp/marque-deploy.log

ADDR=$(grep -oE 'MarquePiece deployed at: 0x[a-fA-F0-9]{40}' /tmp/marque-deploy.log | grep -oE '0x[a-fA-F0-9]{40}' | tail -1 || true)
if [[ -z "$ADDR" ]]; then
  echo "could not parse deployed address from output" >&2
  exit 1
fi

echo "==> deployed at $ADDR"
echo "$ADDR" > "$REPO_ROOT/contracts/.last-deploy-address"
echo "wrote $REPO_ROOT/contracts/.last-deploy-address"
echo
echo "next: set NEXT_PUBLIC_MINT_CONTRACT=$ADDR in apps/web/.env.local"

#!/bin/bash

# Check for wasm32-unknown-unknown target
echo "Checking for wasm32-unknown-unknown target..."
if ! rustup target list --installed | grep -q "wasm32-unknown-unknown"; then
  echo "Installing wasm32-unknown-unknown target..."
  rustup target add wasm32-unknown-unknown
fi

# Clean up any existing container
echo "Cleaning up any existing nitro-dev container..."
docker rm -f nitro-dev 2>/dev/null || true

# Start Nitro dev node in the background
echo "Starting Nitro dev node..."
docker run --rm --name nitro-dev -p 8547:8547 offchainlabs/nitro-node:v3.2.1-d81324d --dev --http.addr 0.0.0.0 --http.api=net,web3,eth,debug --http.corsdomain="*" &

# Wait for the node to initialize
echo "Waiting for the Nitro node to initialize..."

until [[ "$(curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' \
  http://127.0.0.1:8547)" == *"result"* ]]; do
    sleep 0.1
done

# Check if node is running
curl_output=$(curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' \
  http://127.0.0.1:8547)

if [[ "$curl_output" == *"result"* ]]; then
  echo "Nitro node is running!"
else
  echo "Failed to start Nitro node."
  exit 1
fi

# Make the caller a chain owner
echo "Setting chain owner to pre-funded dev account..."
cast send 0x00000000000000000000000000000000000000FF "becomeChainOwner()" \
  --private-key 0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659 \
  --rpc-url http://127.0.0.1:8547

# Deploy Cache Manager Contract
echo "Deploying Cache Manager contract..."
# Deploy a minimal contract for cache manager
cache_manager_bytecode="0x6080604052348015600f57600080fd5b50603f80601d6000396000f3fe6080604052600080fdfea2646970667358221220d62f2a51e8c5c1e1b4b9b3f8e6c49b6c2cce76a9c40d30b23ddcf332156fbd0564736f6c63430008110033"
cache_manager_output=$(cast send --private-key 0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659 --rpc-url http://127.0.0.1:8547 --create "$cache_manager_bytecode")

# Extract cache manager address
cache_manager_address=$(echo "$cache_manager_output" | grep -oE '0x[a-fA-F0-9]{40}')

if [[ -z "$cache_manager_address" ]]; then
  echo "Failed to deploy Cache Manager contract."
  echo "Deploy output: $cache_manager_output"
  exit 1
fi

echo "Cache Manager deployed at: $cache_manager_address"

# Register the Cache Manager
echo "Registering Cache Manager contract..."
registration_output=$(cast send --private-key 0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659 \
  --rpc-url http://127.0.0.1:8547 \
  0x0000000000000000000000000000000000000070 \
  "addWasmCacheManager(address)" "$cache_manager_address")

if [[ "$registration_output" == *"error"* ]]; then
  echo "Failed to register Cache Manager contract. Registration output:"
  echo "$registration_output"
  exit 1
fi

echo "Cache Manager deployed and registered successfully."

# Deploy two ERC20 token contracts for testing Uniswap V2
echo "Deploying first ERC20 token contract (Token0)..."
token0_deploy_output=$(cargo stylus deploy -e http://127.0.0.1:8547 --private-key 0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659 --no-verify)

if [[ $? -ne 0 ]]; then
    echo "Error: Token0 deployment failed"
    echo "Deploy output: $token0_deploy_output"
    exit 1
fi

token0_address=$(echo "$token0_deploy_output" | grep -oE '0x[a-fA-F0-9]{40}')
if [[ ! -z "$token0_address" ]]; then
    echo "Token0 contract deployed at address: $token0_address"
else
    echo "Error: Could not extract Token0 contract address from output"
    echo "Deploy output: $token0_deploy_output"
    exit 1
fi

echo "Deploying second ERC20 token contract (Token1)..."
token1_deploy_output=$(cargo stylus deploy -e http://127.0.0.1:8547 --private-key 0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659 --no-verify)

if [[ $? -ne 0 ]]; then
    echo "Error: Token1 deployment failed"
    echo "Deploy output: $token1_deploy_output"
    exit 1
fi

token1_address=$(echo "$token1_deploy_output" | grep -oE '0x[a-fA-F0-9]{40}')
if [[ ! -z "$token1_address" ]]; then
    echo "Token1 contract deployed at address: $token1_address"
else
    echo "Error: Could1 not extract Token1 contract address from output"
    echo "Deploy output: $token1_deploy_output"
    exit 1
fi

# Mint some tokens to the deployer for testing
echo "Minting tokens for testing..."
cast send --private-key 0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659 --rpc-url http://127.0.0.1:8547 "$token0_address" "_mint(address,uint256)" 0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659 1000000000000000000000
cast send --private-key 0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659 --rpc-url http://127.0.0.1:8547 "$token1_address" "_mint(address,uint256)" 0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659 1000000000000000000000

echo "Tokens minted to deployer address."

# Deploy the Uniswap V2 contract using cargo stylus
echo "Deploying the Uniswap V2 contract using cargo stylus..."
deploy_output=$(cargo stylus deploy -e http://127.0.0.1:8547 --private-key 0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659)

# Check if deployment was successful
if [[ $? -ne 0 ]]; then
    echo "Error: Uniswap V2 contract deployment failed"
    echo "Deploy output: $deploy_output"
    exit 1
fi

# Extract deployment transaction hash from the output
# Assuming the output contains a transaction hash in the format 0x...
deployment_tx=$(echo "$deploy_output" | grep -oE '0x[a-fA-F0-9]{64}')

if [[ -z "$deployment_tx" ]]; then
    echo "Error: Could not extract deployment transaction hash from output"
    echo "Deploy output: $deploy_output"
    exit 1
fi

echo "Deployment transaction hash: $deployment_tx"

# Extract contract address from deploy output (if available)
contract_address=$(echo "$deploy_output" | grep -oE '0x[a-fA-F0-9]{40}')
if [[ ! -z "$contract_address" ]]; then
    echo "Uniswap V2 contract address: $contract_address"
fi

############################################
# Generate the ABI for the deployed contract
echo "Generating ABI for the deployed contract..."
cargo stylus export-abi

# Verify if ABI generation was successful
if [[ $? -ne 0 ]]; then
  echo "Error: ABI generation failed."
  exit 1
fi

echo "ABI generated successfully. Nitro node is running..."

echo "Summary of deployed contracts:"
echo "- Token0: $token0_address"
echo "- Token1: $token1_address"
echo "- Uniswap V2: $contract_address"

# Keep the script running but also monitor the Nitro node
while true; do
  if ! docker ps | grep -q nitro-dev; then
    echo "Nitro node container stopped unexpectedly"
    exit 1
  fi
  sleep 5
done
# Meteora DBC Bundler (Solana + Jito)

Production-oriented TypeScript bot scaffolding for:

- Creating a new coin/pool on Meteora DBC
- Bundling buy transactions with multiple wallets
- Sending bundles through Jito block engine
- Selling from all bundle wallets, then gathering SOL back to main wallet

This repo is designed so you can plug in your preferred Meteora DBC transaction builder (official scripts service, private backend, or your own on-chain instruction builder) while keeping orchestration + wallet + Jito logic stable.

## Features

- **Create + Buy flow**
  - Requests a create transaction
  - Requests buy transactions for all bundler wallets
  - Signs with local keypairs
  - Sends one or more Jito bundles (auto chunking by bundle size)
- **Sell + Gather flow**
  - Builds sell transactions for all bundler wallets
  - Sends sells through Jito bundles
  - Gathers SOL back to the main wallet after selling
- **Wallet handling**
  - Main wallet from `MAIN_WALLET_PRIVATE_KEY`
  - Bundler wallets from `.json` files or env list
- **Config validation**
  - Strict env parsing via `zod`

## Project Structure

- `src/cli.ts` - CLI entry point
- `src/config/env.ts` - Env parsing/validation
- `src/clients/dbcScriptClient.ts` - Meteora DBC tx provider client
- `src/clients/jitoClient.ts` - Jito bundle RPC client
- `src/services/bundlerService.ts` - Create/buy/sell/gather orchestration
- `src/solana/wallet.ts` - Wallet loading and key helpers
- `src/solana/tx.ts` - TX decode/signature helpers

## Prerequisites

- Node.js 20+
- A funded Solana main wallet
- RPC endpoint with good mainnet performance
- Access to a DBC tx script service endpoint that can return unsigned serialized transactions

## Installation

```bash
npm install
```

## Configuration

1. Copy env template:

```bash
cp .env.example .env
```

2. Fill required fields:

- `RPC_URL`
- `MAIN_WALLET_PRIVATE_KEY` (base58)
- `JITO_BLOCK_ENGINE_URLS`
- `JITO_TIP_LAMPORTS`
- `DBC_SCRIPT_API_BASE_URL`

3. Wallet source:

- Option A: set `BUNDLER_WALLET_PRIVATE_KEYS` (comma-separated base58 private keys)
- Option B: put `.json` wallet files in `BUNDLER_WALLET_DIR`

## CLI Usage

### 1) Create coin + bundle buys

```bash
npm run bot -- create-buy \
  --name "My Coin" \
  --symbol "MYC" \
  --uri "https://example.com/meta.json" \
  --decimals 6 \
  --buyLamports 50000000 \
  --slippageBps 300
```

### 2) Sell all bundler wallets + gather

```bash
npm run bot -- sell-gather \
  --pool <POOL_ADDRESS> \
  --mint <MINT_ADDRESS> \
  --sellPercent 100 \
  --slippageBps 500
```

### 3) Gather SOL only

```bash
npm run bot -- gather-sol
```

## DBC Script API Contract

This bot expects your DBC script backend to provide endpoints returning unsigned base64 transactions:

- `POST {DBC_SCRIPT_API_BASE_URL}{DBC_CREATE_ENDPOINT}`
- `POST {DBC_SCRIPT_API_BASE_URL}{DBC_BUY_ENDPOINT}`
- `POST {DBC_SCRIPT_API_BASE_URL}{DBC_SELL_ENDPOINT}`

Each endpoint should return:

```json
{
  "serializedTxBase64": "<base64 versioned tx>",
  "poolAddress": "<optional>",
  "mintAddress": "<optional>"
}
```

If you already have your own builder service, map it in `src/clients/dbcScriptClient.ts`.

## Safety Notes

- Use on test wallets first.
- Keep `BUNDLE_MAX_TX_PER_BUNDLE` <= 5 for Jito constraints.
- Monitor failed bundle statuses and fallback to direct send if needed.
- Never commit `.env` or private keys.

## Disclaimer

Trading and launch automation are risky. You are responsible for compliance, key management, and loss prevention.

export interface CreateCoinRequest {
  creator: string;
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  quoteMint: string;
  initialBuyLamports: number;
  slippageBps: number;
  priorityFeeMicroLamports: number;
}

export interface BuyRequest {
  wallet: string;
  mint: string;
  pool: string;
  quoteMint: string;
  buyLamports: number;
  slippageBps: number;
  priorityFeeMicroLamports: number;
}

export interface SellRequest {
  wallet: string;
  mint: string;
  pool: string;
  sellPercent: number;
  slippageBps: number;
  priorityFeeMicroLamports: number;
}

export interface ScriptTxResponse {
  serializedTxBase64: string;
  poolAddress?: string;
  mintAddress?: string;
}

export interface BundleSendResult {
  endpoint: string;
  bundleId?: string;
  ok: boolean;
  error?: string;
}


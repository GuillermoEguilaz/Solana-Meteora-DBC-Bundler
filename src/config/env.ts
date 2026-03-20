import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  RPC_URL: z.string().min(1),
  MAIN_WALLET_PRIVATE_KEY: z.string().min(1),
  BUNDLER_WALLET_PRIVATE_KEYS: z.string().optional().default(""),
  BUNDLER_WALLET_DIR: z.string().optional().default("wallets"),
  JITO_BLOCK_ENGINE_URLS: z.string().min(1),
  JITO_TIP_LAMPORTS: z.coerce.number().int().positive().default(5_000_000),
  BUNDLE_MAX_TX_PER_BUNDLE: z.coerce.number().int().min(2).max(5).default(5),
  DBC_SCRIPT_API_BASE_URL: z.string().min(1),
  DBC_CREATE_ENDPOINT: z.string().default("/create-coin-tx"),
  DBC_BUY_ENDPOINT: z.string().default("/buy-tx"),
  DBC_SELL_ENDPOINT: z.string().default("/sell-tx"),
  DEFAULT_QUOTE_MINT: z
    .string()
    .default("So11111111111111111111111111111111111111112"),
  DEFAULT_PRIORITY_FEE_MICROLAMPORTS: z.coerce.number().int().nonnegative().default(50_000)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errorLines = parsed.error.errors.map(
    (e) => `${e.path.join(".") || "env"}: ${e.message}`
  );
  throw new Error(`Invalid environment:\n${errorLines.join("\n")}`);
}

export const env = {
  ...parsed.data,
  jitoBlockEngineUrls: parsed.data.JITO_BLOCK_ENGINE_URLS.split(",")
    .map((x) => x.trim())
    .filter(Boolean)
};


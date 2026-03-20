import fs from "node:fs";
import path from "node:path";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import { env } from "../config/env.js";

function decodeBase58Key(secret: string): Uint8Array {
  const clean = secret.trim();
  if (!clean) {
    throw new Error("Empty private key");
  }
  return bs58.decode(clean);
}

function keypairFromBase58(secret: string): Keypair {
  return Keypair.fromSecretKey(decodeBase58Key(secret));
}

function keypairFromJsonFile(filePath: string): Keypair {
  const raw = fs.readFileSync(filePath, "utf8");
  const bytes = JSON.parse(raw) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

export function loadMainWallet(): Keypair {
  return keypairFromBase58(env.MAIN_WALLET_PRIVATE_KEY);
}

function loadBundlerWalletsFromEnv(): Keypair[] {
  const secrets = env.BUNDLER_WALLET_PRIVATE_KEYS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return secrets.map(keypairFromBase58);
}

function loadBundlerWalletsFromDir(): Keypair[] {
  const dirPath = path.resolve(process.cwd(), env.BUNDLER_WALLET_DIR);
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const files = fs
    .readdirSync(dirPath)
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  return files.map((file) => keypairFromJsonFile(path.join(dirPath, file)));
}

export function loadBundlerWallets(): Keypair[] {
  const fromEnv = loadBundlerWalletsFromEnv();
  if (fromEnv.length > 0) {
    return fromEnv;
  }
  return loadBundlerWalletsFromDir();
}


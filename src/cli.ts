import { BundlerService } from "./services/bundlerService.js";
import { loadBundlerWallets, loadMainWallet } from "./solana/wallet.js";

function getArg(name: string, fallback?: string): string {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1]!;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Missing required arg --${name}`);
}

function getOptionalArg(name: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1]!;
  }
  return undefined;
}

function toNumber(raw: string, label: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid number for ${label}: ${raw}`);
  }
  return n;
}

async function run(): Promise<void> {
  const command = process.argv[2];
  if (!command) {
    throw new Error("Usage: npm run bot -- <create-buy|sell-gather|gather-sol> [--flags]");
  }

  const creator = loadMainWallet();
  const wallets = loadBundlerWallets();
  const service = new BundlerService();

  if (wallets.length === 0 && command !== "gather-sol") {
    throw new Error("No bundler wallets loaded. Set BUNDLER_WALLET_PRIVATE_KEYS or BUNDLER_WALLET_DIR");
  }

  if (command === "create-buy") {
    const name = getArg("name");
    const symbol = getArg("symbol");
    const uri = getArg("uri");
    const decimals = toNumber(getArg("decimals", "6"), "decimals");
    const buyLamports = toNumber(getArg("buyLamports"), "buyLamports");
    const slippageBps = toNumber(getArg("slippageBps", "300"), "slippageBps");
    const quoteMint = getOptionalArg("quoteMint");

    const result = await service.createCoinAndBundleBuys({
      creator,
      buyers: wallets,
      name,
      symbol,
      uri,
      decimals,
      buyLamports,
      slippageBps,
      quoteMint
    });

    console.log("Create+buy flow completed.");
    console.log(`Mint: ${result.mint}`);
    console.log(`Pool: ${result.pool}`);
    return;
  }

  if (command === "sell-gather") {
    const pool = getArg("pool");
    const mint = getArg("mint");
    const sellPercent = toNumber(getArg("sellPercent", "100"), "sellPercent");
    const slippageBps = toNumber(getArg("slippageBps", "500"), "slippageBps");

    await service.sellFromAllAndGather({
      creator,
      sellers: wallets,
      pool,
      mint,
      sellPercent,
      slippageBps
    });

    console.log("Sell+gather flow completed.");
    return;
  }

  if (command === "gather-sol") {
    await service.gatherSol(wallets, creator.publicKey);
    return;
  }

  if (command === "help") {
    console.log(
      [
        "Commands:",
        "  create-buy --name <name> --symbol <symbol> --uri <uri> --buyLamports <lamports> [--decimals 6] [--slippageBps 300] [--quoteMint <mint>]",
        "  sell-gather --pool <pool> --mint <mint> [--sellPercent 100] [--slippageBps 500]",
        "  gather-sol"
      ].join("\n")
    );
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal: ${message}`);
  process.exit(1);
});


import {
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction
} from "@solana/web3.js";
import { env } from "../config/env.js";
import { DbcScriptClient } from "../clients/dbcScriptClient.js";
import { JitoClient } from "../clients/jitoClient.js";
import { chunkArray, deserializeVersionedTx, signTx, txSignature } from "../solana/tx.js";
import { connection } from "../solana/connection.js";

export interface CreateBuyInput {
  creator: Keypair;
  buyers: Keypair[];
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  buyLamports: number;
  slippageBps: number;
  quoteMint?: string;
}

export interface SellGatherInput {
  creator: Keypair;
  sellers: Keypair[];
  pool: string;
  mint: string;
  sellPercent: number;
  slippageBps: number;
}

export class BundlerService {
  private readonly dbcClient = new DbcScriptClient();
  private readonly jitoClient = new JitoClient();

  public async createCoinAndBundleBuys(input: CreateBuyInput): Promise<{
    mint: string;
    pool: string;
  }> {
    const mintKp = Keypair.generate();
    const quoteMint = input.quoteMint ?? env.DEFAULT_QUOTE_MINT;

    const createResp = await this.dbcClient.buildCreateCoinTx({
      creator: input.creator.publicKey.toBase58(),
      mint: mintKp.publicKey.toBase58(),
      name: input.name,
      symbol: input.symbol,
      uri: input.uri,
      decimals: input.decimals,
      quoteMint,
      initialBuyLamports: input.buyLamports,
      slippageBps: input.slippageBps,
      priorityFeeMicroLamports: env.DEFAULT_PRIORITY_FEE_MICROLAMPORTS
    });

    const createTx = signTx(
      deserializeVersionedTx(createResp.serializedTxBase64),
      [input.creator, mintKp]
    );

    const pool = createResp.poolAddress;
    const mint = createResp.mintAddress ?? mintKp.publicKey.toBase58();

    if (!pool) {
      throw new Error("create response does not include poolAddress");
    }

    const buyTxs = await Promise.all(
      input.buyers.map(async (buyer) => {
        const buyResp = await this.dbcClient.buildBuyTx({
          wallet: buyer.publicKey.toBase58(),
          mint,
          pool,
          quoteMint,
          buyLamports: input.buyLamports,
          slippageBps: input.slippageBps,
          priorityFeeMicroLamports: env.DEFAULT_PRIORITY_FEE_MICROLAMPORTS
        });
        return signTx(deserializeVersionedTx(buyResp.serializedTxBase64), [buyer]);
      })
    );

    const txGroups: VersionedTransaction[][] = [];
    const maxWithoutTip = env.BUNDLE_MAX_TX_PER_BUNDLE - 1;
    const firstCapacity = Math.max(1, maxWithoutTip - 1);
    const firstGroup = [createTx, ...buyTxs.slice(0, firstCapacity)];
    txGroups.push(firstGroup);

    const remainingBuys = buyTxs.slice(firstCapacity);
    for (const chunk of chunkArray(remainingBuys, maxWithoutTip)) {
      txGroups.push(chunk);
    }

    for (const group of txGroups) {
      const sent = await this.jitoClient.sendBundle(group, input.creator);
      if (!sent.some((x) => x.ok)) {
        throw new Error(`Jito send failed for all endpoints: ${JSON.stringify(sent)}`);
      }
      const confirmed = await this.jitoClient.confirmTxSignatures(group);
      if (!confirmed) {
        throw new Error("One or more txs in bundle failed confirmation");
      }
    }

    return { mint, pool };
  }

  public async sellFromAllAndGather(input: SellGatherInput): Promise<void> {
    const sellTxs = await Promise.all(
      input.sellers.map(async (seller) => {
        const sellResp = await this.dbcClient.buildSellTx({
          wallet: seller.publicKey.toBase58(),
          pool: input.pool,
          mint: input.mint,
          sellPercent: input.sellPercent,
          slippageBps: input.slippageBps,
          priorityFeeMicroLamports: env.DEFAULT_PRIORITY_FEE_MICROLAMPORTS
        });
        return signTx(deserializeVersionedTx(sellResp.serializedTxBase64), [seller]);
      })
    );

    const maxWithoutTip = env.BUNDLE_MAX_TX_PER_BUNDLE - 1;
    for (const group of chunkArray(sellTxs, maxWithoutTip)) {
      const sent = await this.jitoClient.sendBundle(group, input.creator);
      if (!sent.some((x) => x.ok)) {
        throw new Error(`Jito sell bundle failed: ${JSON.stringify(sent)}`);
      }
      const confirmed = await this.jitoClient.confirmTxSignatures(group);
      if (!confirmed) {
        throw new Error("Sell bundle had failed tx confirmation");
      }
    }

    await this.gatherSol(input.sellers, input.creator.publicKey);
  }

  public async gatherSol(fromWallets: Keypair[], destination: PublicKey): Promise<void> {
    for (const wallet of fromWallets) {
      const balance = await connection.getBalance(wallet.publicKey, "confirmed");
      const keepRent = 100_000;
      if (balance <= keepRent) {
        continue;
      }

      const transferLamports = balance - keepRent;
      const latest = await connection.getLatestBlockhash("confirmed");
      const message = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: latest.blockhash,
        instructions: [
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: env.DEFAULT_PRIORITY_FEE_MICROLAMPORTS
          }),
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: destination,
            lamports: transferLamports
          })
        ]
      }).compileToV0Message();

      const tx = new VersionedTransaction(message);
      tx.sign([wallet]);

      const sig = await connection.sendTransaction(tx, { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction(
        {
          signature: sig,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight
        },
        "confirmed"
      );
    }

    const destinationBalance = await connection.getBalance(destination, "confirmed");
    const sol = destinationBalance / LAMPORTS_PER_SOL;
    console.log(`Gather complete. Destination balance: ${sol.toFixed(4)} SOL`);
  }

  public printTxSignatures(txs: VersionedTransaction[]): void {
    for (const tx of txs) {
      console.log(`tx: ${txSignature(tx)}`);
    }
  }
}


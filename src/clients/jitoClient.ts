import axios from "axios";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction
} from "@solana/web3.js";
import { env } from "../config/env.js";
import { connection } from "../solana/connection.js";
import { BundleSendResult } from "../types.js";
import { serializeTxBase64, txSignature } from "../solana/tx.js";

const TIP_ACCOUNTS = [
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh"
];

export class JitoClient {
  private randomTipAccount(): string {
    const idx = Math.floor(Math.random() * TIP_ACCOUNTS.length);
    return TIP_ACCOUNTS[idx]!;
  }

  public async buildTipTx(payer: Keypair): Promise<VersionedTransaction> {
    const latest = await connection.getLatestBlockhash("confirmed");
    const tipAccount = this.randomTipAccount();
    const message = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: latest.blockhash,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: new PublicKey(tipAccount),
          lamports: env.JITO_TIP_LAMPORTS
        })
      ]
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([payer]);
    return tx;
  }

  public async sendBundle(
    transactions: VersionedTransaction[],
    tipPayer: Keypair
  ): Promise<BundleSendResult[]> {
    const tipTx = await this.buildTipTx(tipPayer);
    const bundle = [tipTx, ...transactions].slice(0, env.BUNDLE_MAX_TX_PER_BUNDLE);
    const encodedTxs = bundle.map(serializeTxBase64);

    return Promise.all(
      env.jitoBlockEngineUrls.map(async (url) => {
        try {
          const { data } = await axios.post(
            url,
            {
              jsonrpc: "2.0",
              id: 1,
              method: "sendBundle",
              params: [encodedTxs]
            },
            { timeout: 20_000 }
          );

          return {
            endpoint: url,
            bundleId: data?.result,
            ok: true
          } satisfies BundleSendResult;
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown error";
          return {
            endpoint: url,
            ok: false,
            error: message
          } satisfies BundleSendResult;
        }
      })
    );
  }

  public async confirmTxSignatures(transactions: VersionedTransaction[]): Promise<boolean> {
    const latest = await connection.getLatestBlockhash("confirmed");
    const signatures = transactions.map(txSignature);

    for (const signature of signatures) {
      const result = await connection.confirmTransaction(
        {
          signature,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight
        },
        "confirmed"
      );

      if (result.value.err) {
        return false;
      }
    }

    return true;
  }
}


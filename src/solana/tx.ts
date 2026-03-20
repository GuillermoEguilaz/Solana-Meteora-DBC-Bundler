import bs58 from "bs58";
import { Keypair, VersionedTransaction } from "@solana/web3.js";

export function deserializeVersionedTx(base64: string): VersionedTransaction {
  const bytes = Buffer.from(base64, "base64");
  return VersionedTransaction.deserialize(bytes);
}

export function txSignature(tx: VersionedTransaction): string {
  const sig = tx.signatures[0];
  if (!sig) {
    throw new Error("Transaction has no signatures");
  }
  return bs58.encode(sig);
}

export function signTx(tx: VersionedTransaction, signers: Keypair[]): VersionedTransaction {
  tx.sign(signers);
  return tx;
}

export function serializeTxBase64(tx: VersionedTransaction): string {
  return Buffer.from(tx.serialize()).toString("base64");
}

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(items.slice(i, i + chunkSize));
  }
  return out;
}


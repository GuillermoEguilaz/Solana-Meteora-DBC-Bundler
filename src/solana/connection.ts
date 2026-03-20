import { Connection } from "@solana/web3.js";
import { env } from "../config/env.js";

export const connection = new Connection(env.RPC_URL, {
  commitment: "confirmed"
});


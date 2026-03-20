import axios, { AxiosInstance } from "axios";
import { env } from "../config/env.js";
import {
  BuyRequest,
  CreateCoinRequest,
  ScriptTxResponse,
  SellRequest
} from "../types.js";

export class DbcScriptClient {
  private readonly http: AxiosInstance;

  public constructor() {
    this.http = axios.create({
      baseURL: env.DBC_SCRIPT_API_BASE_URL,
      timeout: 30_000
    });
  }

  public async buildCreateCoinTx(payload: CreateCoinRequest): Promise<ScriptTxResponse> {
    const { data } = await this.http.post<ScriptTxResponse>(env.DBC_CREATE_ENDPOINT, payload);
    this.validateResponse(data, "create");
    return data;
  }

  public async buildBuyTx(payload: BuyRequest): Promise<ScriptTxResponse> {
    const { data } = await this.http.post<ScriptTxResponse>(env.DBC_BUY_ENDPOINT, payload);
    this.validateResponse(data, "buy");
    return data;
  }

  public async buildSellTx(payload: SellRequest): Promise<ScriptTxResponse> {
    const { data } = await this.http.post<ScriptTxResponse>(env.DBC_SELL_ENDPOINT, payload);
    this.validateResponse(data, "sell");
    return data;
  }

  private validateResponse(
    data: ScriptTxResponse | undefined,
    op: "create" | "buy" | "sell"
  ): asserts data is ScriptTxResponse {
    if (!data?.serializedTxBase64) {
      throw new Error(`DBC script API returned invalid ${op} response (missing serializedTxBase64)`);
    }
  }
}


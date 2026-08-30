import { invoke } from "@tauri-apps/api/core";
import type { Context } from "ajanuw-context";
import type { HttpClient } from "@/domain/http/HttpClient";
import { commands } from "@/generated/tauri-commands";
import type { AiClient } from "../../domain/ai/AiClient";

export class TauriAiClient implements AiClient {
  constructor(private readonly httpClient: HttpClient) {}

  async post(
    ctx: Context,
    endpoint: string,
    apiKey: string,
    payload: unknown,
  ): Promise<unknown> {
    const port = await invoke<number>(commands.get_stream_port);

    const response = await this.httpClient.request(
      `http://127.0.0.1:${port}/ai/chat-request`,
      {
        ctx,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          api_key: apiKey,
          body_json: JSON.stringify(payload),
        }),
      },
    );

    const text = await response.text();
    return JSON.parse(text);
  }
}

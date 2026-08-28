import { invoke } from "@tauri-apps/api/core";
import type { Context } from "ajanuw-context";
import { Canceled } from "ajanuw-context";
import { commands } from "@/generated/tauri-commands";
import type { AiClient } from "../../domain/ai/AiClient";

/**
 * Tauri 平台的大模型客户端实现。
 * 通过 Tauri Invoke 调用 Rust 后端，以在桌面端免除浏览器的 CORS 跨域拦截。
 */
export class TauriAiClient implements AiClient {
  async post(
    ctx: Context,
    endpoint: string,
    apiKey: string,
    payload: unknown,
  ): Promise<unknown> {
    if (ctx.err() === Canceled) throw new Error("AI 请求已被取消");

    const responseText = await invoke<string>(commands.ai_chat_request, {
      endpoint,
      apiKey,
      bodyJson: JSON.stringify(payload),
    });
    return JSON.parse(responseText);
  }
}

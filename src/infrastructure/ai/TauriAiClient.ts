import { invoke } from "@tauri-apps/api/core";
import type { AiClient } from "../../domain/ai/AiClient";

/**
 * Tauri 平台的大模型客户端实现。
 * 通过 Tauri Invoke 调用 Rust 后端，以在桌面端免除浏览器的 CORS 跨域拦截。
 */
export class TauriAiClient implements AiClient {
	async post(
		endpoint: string,
		apiKey: string,
		payload: unknown,
	): Promise<unknown> {
		const responseText = await invoke<string>("ai_chat_request", {
			endpoint,
			apiKey,
			bodyJson: JSON.stringify(payload),
		});
		return JSON.parse(responseText);
	}
}

/**
 * AiClient 定义了大模型接口请求的抽象。
 * 它属于领域层，用来隔离平台特定的网络调用（如浏览器 fetch 和 Tauri Rust 端的 invoke）。
 */
export interface AiClient {
	/**
	 * 发送一个 Chat Completion 聊天请求
	 * @param endpoint 请求的大模型 API 端点
	 * @param apiKey 大模型接口密钥
	 * @param payload 请求的主体 payload，符合 OpenAI 接口规范
	 * @returns 返回大模型响应反序列化后的 JSON 对象
	 */
	post(endpoint: string, apiKey: string, payload: unknown): Promise<unknown>;
}

import type { AiClient } from "../../domain/ai/AiClient";

export interface VerifyAiConnectionDto {
	apiEndpoint: string;
	apiKey: string;
	model?: string;
}

export class VerifyAiConnectionUseCase {
	constructor(private aiClient: AiClient) {}

	async execute(dto: VerifyAiConnectionDto): Promise<void> {
		const endpoint = dto.apiEndpoint.trim();
		const apiKey = dto.apiKey.trim();

		if (!endpoint) {
			throw new Error("请输入 AI 接口地址");
		}
		if (!apiKey) {
			throw new Error("请输入 API 密钥");
		}

		const model = dto.model?.trim() || "gpt-3.5-turbo";

		const response = (await this.aiClient.post(endpoint, apiKey, {
			model,
			messages: [
				{
					role: "user",
					content: "Ping",
				},
			],
			temperature: 0.1,
			max_tokens: 5,
		})) as { choices?: unknown[] };

		if (!response?.choices || response.choices.length === 0) {
			throw new Error("模型服务未返回有效响应，请检查配置");
		}
	}
}

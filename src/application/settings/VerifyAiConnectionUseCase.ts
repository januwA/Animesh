import { Background } from "ajanuw-context";
import {
  type AiConfig,
  AiConfigSchema,
} from "@/domain/settings/SettingsSchemas";
import type { AiClient } from "../../domain/ai/AiClient";

export class VerifyAiConnectionUseCase {
  constructor(private aiClient: AiClient) {}

  async execute(dto: AiConfig): Promise<void> {
    const parsed = AiConfigSchema.parse(dto);

    const response = (await this.aiClient.post(
      Background,
      parsed.api_endpoint,
      parsed.api_key,
      {
        model: parsed.ai_model,
        messages: [
          {
            role: "user",
            content: "Ping",
          },
        ],
        temperature: 0.1,
        max_tokens: 5,
      },
    )) as { choices?: unknown[] };

    if (!response?.choices || response.choices.length === 0) {
      throw new Error("模型服务未返回有效响应，请检查配置");
    }
  }
}

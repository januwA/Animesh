import type { Context } from "ajanuw-context";
import type { AiClient } from "@/domain/ai/AiClient";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import { AiConfigSchema } from "@/domain/settings/SettingsSchemas";
import type { TranslationService } from "@/domain/translation/TranslationService";

/**
 * 基于 LLM 大模型的翻译实现。
 * 复用现有 AiClient 接口，通过 Chat Completion 进行翻译。
 */
export class AiTranslateClient implements TranslationService {
  constructor(private readonly aiClient: AiClient) {}

  async translate(
    ctx: Context,
    text: string,
    sourceLang: string,
    targetLang: string,
    options?: { aiConfig?: AiConfig },
  ): Promise<string> {
    const aiConfig = options?.aiConfig;
    if (!aiConfig || !AiConfigSchema.safeParse(aiConfig).success) {
      throw new Error("AI 配置无效，请在设置中配置 AI 接口");
    }

    const sourceDesc = sourceLang === "auto" ? "自动识别的源语言" : sourceLang;
    const payload = {
      model: aiConfig.ai_model,
      messages: [
        {
          role: "system",
          content: this.buildSystemPrompt(sourceDesc, targetLang),
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.1,
    };

    const res = await this.aiClient.post(
      ctx,
      aiConfig.api_endpoint,
      aiConfig.api_key,
      payload,
    );

    return this.extractContent(res);
  }

  private buildSystemPrompt(sourceLang: string, targetLang: string): string {
    return `你是一个专业的翻译助手。请把用户给出的文本从${sourceLang}翻译成${targetLang}。

严格要求：
1. 只返回翻译后的文本，不要任何解释、注释或 markdown 标记。
2. 保持原文的语气和风格。
3. 人名、专有名词保留原文或采用公认译名。`;
  }

  private extractContent(res: unknown): string {
    const content =
      (res as { choices?: { message?: { content?: string | null } }[] })
        ?.choices?.[0]?.message?.content ?? "";
    return content.trim();
  }
}

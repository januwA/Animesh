import type { Context } from "ajanuw-context";
import type {
  AiConfig,
  TranslationProvider,
} from "@/domain/settings/SettingsSchemas";
import type { TranslationCache } from "@/domain/translation/TranslationCache";
import type { TranslationService } from "@/domain/translation/TranslationService";

export interface TranslateTextDto {
  text: string;
  sourceLang: string;
  targetLang: string;
  provider: TranslationProvider;
  aiConfig?: AiConfig;
}

/**
 * 翻译文本用例。
 *
 * 工作流程：
 * 1. 检查缓存 → 命中则直接返回
 * 2. 根据 provider 选择翻译服务
 * 3. 调用翻译服务
 * 4. 写入缓存
 * 5. 返回翻译结果
 */
export class TranslateTextUseCase {
  constructor(
    private readonly googleTranslate: TranslationService,
    private readonly aiTranslate: TranslationService,
    private readonly cache: TranslationCache,
  ) {}

  async execute(ctx: Context, dto: TranslateTextDto): Promise<string> {
    const text = dto.text.trim();
    if (text === "") return "";

    const cacheKey = this.buildCacheKey(text, dto.sourceLang, dto.targetLang);

    const cached = await this.cache.get(cacheKey);
    if (cached !== null) return cached;

    const translated = await this.translateWithProvider(ctx, dto, text);

    await this.cache.set(cacheKey, translated);

    return translated;
  }

  private async translateWithProvider(
    ctx: Context,
    dto: TranslateTextDto,
    text: string,
  ): Promise<string> {
    const service = this.selectService(dto.provider);

    if (ctx.err()) throw new Error("翻译已被取消");

    return service.translate(text, dto.sourceLang, dto.targetLang, {
      aiConfig: dto.aiConfig,
    });
  }

  private selectService(provider: TranslationProvider): TranslationService {
    switch (provider) {
      case "google":
        return this.googleTranslate;
      case "ai":
        return this.aiTranslate;
    }
  }

  private buildCacheKey(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): string {
    // 使用简单的字符串拼接作为缓存键
    // 因为 text 可能很长，这里用轻量级的方式
    return `${sourceLang}:${targetLang}:${text}`;
  }
}

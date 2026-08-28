import type { AiConfig } from "../settings/SettingsSchemas";

/**
 * 翻译服务接口，定义文本翻译的抽象。
 * 不同的翻译提供者（Google Translate、LLM 等）各自实现此接口。
 */
export interface TranslationService {
  /**
   * 将文本翻译为目标语言
   * @param text 待翻译的文本（调用方保证非空）
   * @param sourceLang 源语言代码（如 "auto"、"en"、"ja"）
   * @param targetLang 目标语言代码（如 "zh-CN"）
   * @param options 可选配置（如 AI 模型配置）
   * @returns 翻译后的文本
   */
  translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    options?: { aiConfig?: AiConfig },
  ): Promise<string>;
}

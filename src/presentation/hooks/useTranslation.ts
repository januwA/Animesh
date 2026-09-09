import { useCallback, useState } from "react";
import { useDI } from "@/di/DIContext";
import type {
  AiConfig,
  TranslationProvider,
} from "@/domain/settings/SettingsSchemas";
import { useMutation } from "./useMutation";

export interface UseTranslationOptions {
  /** 源语言代码，默认 "auto"（自动检测） */
  sourceLang?: string;
  /** 目标语言代码，默认从设置中读取 */
  targetLang?: string;
  /** 翻译提供者，默认从设置中读取 */
  provider?: TranslationProvider;
}

export interface UseTranslationResult {
  /** 翻译后的文本（未翻译时为 null） */
  translatedText: string | null;
  /** 是否正在翻译中 */
  loading: boolean;
  /** 翻译错误信息 */
  error: Error | null;
  /** 是否已翻译 */
  isTranslated: boolean;
  /** 执行翻译 */
  translate: () => Promise<void>;
  /** 切换显示原文/译文 */
  toggle: () => void;
  /** 当前是否显示原文 */
  showingOriginal: boolean;
}

/**
 * 文本翻译 Hook，提供翻译和切换原文/译文的功能。
 *
 * @param text 待翻译的原始文本
 * @param options 翻译选项
 */
export function useTranslation(
  text: string,
  options: UseTranslationOptions = {},
): UseTranslationResult {
  const {
    getTranslationConfigUseCase,
    getAiConfigsUseCase,
    translateTextUseCase,
  } = useDI();
  const [showingOriginal, setShowingOriginal] = useState(false);

  const { data, loading, error, execute } = useMutation<string, string>(
    async (ctx, text) => {
      // 并行获取翻译配置与 AI 配置
      const [translationConfig, { aiConfigs }] = await Promise.all([
        getTranslationConfigUseCase.execute(),
        getAiConfigsUseCase.execute(),
      ]);
      if (ctx.err()) return "";

      const targetLang = options.targetLang ?? translationConfig.target_lang;
      const provider = options.provider ?? translationConfig.provider;
      const sourceLang = options.sourceLang ?? "auto";

      // 获取 AI 配置（如果使用 AI 翻译）
      let aiConfig: AiConfig | undefined;
      if (provider === "ai" && translationConfig.ai_config_alias) {
        aiConfig = aiConfigs.find(
          (c) => c.alias === translationConfig.ai_config_alias,
        );
      }

      // v8 ignore next
      if (ctx.err()) return "";
      return translateTextUseCase.execute(ctx, {
        text,
        sourceLang,
        targetLang,
        provider,
        aiConfig,
      });
    },
    { onSuccess: () => setShowingOriginal(false) },
  );

  const translate = useCallback(async () => {
    if (text.trim() === "") return;
    await execute(text);
  }, [text, execute]);

  const toggle = useCallback(() => {
    setShowingOriginal((prev) => !prev);
  }, []);

  return {
    translatedText: data,
    loading,
    error,
    isTranslated: data !== null,
    translate,
    toggle,
    showingOriginal,
  };
}

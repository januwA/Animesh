import { useCallback, useEffect, useRef, useState } from "react";
import { useDI } from "@/di/DIContext";
import type {
  AiConfig,
  TranslationProvider,
} from "@/domain/settings/SettingsSchemas";

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
    getSettingsUseCase,
    translateTextUseCase,
    getSettingsUseCase: _getSettings,
  } = useDI();
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const translate = useCallback(async () => {
    if (text.trim() === "") return;

    // 取消上一次请求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      // 获取设置
      const settings = await getSettingsUseCase.execute();
      const translationConfig = settings.translation;

      const targetLang = options.targetLang ?? translationConfig.target_lang;
      const provider = options.provider ?? translationConfig.provider;
      const sourceLang = options.sourceLang ?? "auto";

      // 获取 AI 配置（如果使用 AI 翻译）
      let aiConfig: AiConfig | undefined;
      if (
        provider === "ai" &&
        translationConfig.ai_config_alias &&
        settings.ai_configs
      ) {
        aiConfig = settings.ai_configs.find(
          (c) => c.alias === translationConfig.ai_config_alias,
        );
      }

      // 使用 Context 实现取消
      const { WithCancel, Background } = await import("ajanuw-context");
      const [ctx, cancel] = WithCancel(Background);

      // 监听 abort 事件
      controller.signal.addEventListener("abort", () => {
        cancel();
      });

      if (controller.signal.aborted) return;

      const result = await translateTextUseCase.execute(ctx, {
        text,
        sourceLang,
        targetLang,
        provider,
        aiConfig,
      });

      if (!controller.signal.aborted) {
        setTranslatedText(result);
        setShowingOriginal(false);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [
    text,
    options.sourceLang,
    options.targetLang,
    options.provider,
    getSettingsUseCase,
    translateTextUseCase,
  ]);

  const toggle = useCallback(() => {
    setShowingOriginal((prev) => !prev);
  }, []);

  // 组件卸载时取消请求
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    translatedText,
    loading,
    error,
    isTranslated: translatedText !== null,
    translate,
    toggle,
    showingOriginal,
  };
}

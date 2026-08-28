import type { Context } from "ajanuw-context";
import { Background, WithCancel } from "ajanuw-context";
import { describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TranslationCache } from "@/domain/translation/TranslationCache";
import type { TranslationService } from "@/domain/translation/TranslationService";
import { fnv1a32 } from "@/utils";
import { TranslateTextUseCase } from "./TranslateTextUseCase";

function createMockTranslationService(
  translateFn?: (ctx: Context, text: string) => Promise<string>,
): TranslationService {
  return {
    translate: vi.fn(
      translateFn ??
        (async (_ctx: Context, text: string) => `translated:${text}`),
    ),
  };
}

function createMockCache(
  store: Map<string, string> = new Map(),
): TranslationCache {
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
}

function createCtx(): Context {
  const [ctx] = WithCancel(Background);
  return ctx;
}

describe("TranslateTextUseCase", () => {
  it("空文本应直接返回空字符串，不调用翻译服务", async () => {
    const google = createMockTranslationService();
    const ai = createMockTranslationService();
    const cache = createMockCache();
    const useCase = new TranslateTextUseCase(google, ai, cache);

    const result = await useCase.execute(createCtx(), {
      text: "   ",
      sourceLang: "auto",
      targetLang: "zh-CN",
      provider: "google",
    });

    expect(result).toBe("");
    expect(google.translate).not.toHaveBeenCalled();
    expect(ai.translate).not.toHaveBeenCalled();
  });

  it("缓存命中时应直接返回缓存结果，不调用翻译服务", async () => {
    const google = createMockTranslationService();
    const ai = createMockTranslationService();
    const cache = createMockCache(
      new Map([[fnv1a32("auto:zh-CN:hello"), "你好"]]),
    );
    const useCase = new TranslateTextUseCase(google, ai, cache);

    const result = await useCase.execute(createCtx(), {
      text: "hello",
      sourceLang: "auto",
      targetLang: "zh-CN",
      provider: "google",
    });

    expect(result).toBe("你好");
    expect(google.translate).not.toHaveBeenCalled();
  });

  it("使用 Google 翻译时应调用 googleTranslate 服务", async () => {
    const google = createMockTranslationService();
    const ai = createMockTranslationService();
    const cache = createMockCache();
    const useCase = new TranslateTextUseCase(google, ai, cache);

    const result = await useCase.execute(createCtx(), {
      text: "hello",
      sourceLang: "auto",
      targetLang: "zh-CN",
      provider: "google",
    });

    expect(result).toBe("translated:hello");
    expect(google.translate).toHaveBeenCalledWith(
      expect.anything(),
      "hello",
      "auto",
      "zh-CN",
      { aiConfig: undefined },
    );
    expect(ai.translate).not.toHaveBeenCalled();
  });

  it("使用 AI 翻译时应调用 aiTranslate 服务", async () => {
    const google = createMockTranslationService();
    const ai = createMockTranslationService();
    const cache = createMockCache();
    const useCase = new TranslateTextUseCase(google, ai, cache);

    const aiConfig = {
      alias: NonEmptyStringSchema.parse("test"),
      api_endpoint: NonEmptyStringSchema.parse("https://api.example.com"),
      api_key: NonEmptyStringSchema.parse("test-key"),
      ai_model: NonEmptyStringSchema.parse("gpt-4"),
    };

    const result = await useCase.execute(createCtx(), {
      text: "hello",
      sourceLang: "en",
      targetLang: "zh-CN",
      provider: "ai",
      aiConfig,
    });

    expect(result).toBe("translated:hello");
    expect(ai.translate).toHaveBeenCalledWith(
      expect.anything(),
      "hello",
      "en",
      "zh-CN",
      { aiConfig },
    );
    expect(google.translate).not.toHaveBeenCalled();
  });

  it("翻译成功后应将结果写入缓存", async () => {
    const google = createMockTranslationService();
    const ai = createMockTranslationService();
    const cache = createMockCache();
    const useCase = new TranslateTextUseCase(google, ai, cache);

    await useCase.execute(createCtx(), {
      text: "hello",
      sourceLang: "auto",
      targetLang: "zh-CN",
      provider: "google",
    });

    expect(cache.set).toHaveBeenCalledWith(
      fnv1a32("auto:zh-CN:hello"),
      "translated:hello",
    );
  });

  it("翻译失败时应抛出错误", async () => {
    const google = createMockTranslationService(async () => {
      throw new Error("网络错误");
    });
    const ai = createMockTranslationService();
    const cache = createMockCache();
    const useCase = new TranslateTextUseCase(google, ai, cache);

    await expect(
      useCase.execute(createCtx(), {
        text: "hello",
        sourceLang: "auto",
        targetLang: "zh-CN",
        provider: "google",
      }),
    ).rejects.toThrow("网络错误");
  });
});

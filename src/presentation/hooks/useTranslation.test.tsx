import { act, renderHook, waitFor } from "@testing-library/react";
import { Canceled } from "ajanuw-context";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIContext } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type {
  AiConfig,
  TranslationConfig,
} from "@/domain/settings/SettingsSchemas";
import { useTranslation } from "./useTranslation";

const defaultTranslationConfig: TranslationConfig = {
  target_lang: "zh-CN",
  provider: "google",
  ai_config_alias: null,
};

const mockAiConfig: AiConfig = {
  alias: NonEmptyStringSchema.parse("my-ai"),
  api_endpoint: NonEmptyStringSchema.parse("https://api.example.com/v1"),
  api_key: NonEmptyStringSchema.parse("sk-test"),
  ai_model: NonEmptyStringSchema.parse("gpt-4o"),
};

/** 创建可手动控制 resolve/reject 的翻译用例 mock，可捕获传入的 ctx */
function createDeferredTranslate(ctxs?: Array<{ err: () => unknown }>) {
  const deferreds: Array<{
    resolve: (value: string) => void;
    reject: (reason?: unknown) => void;
  }> = [];
  const execute = vi.fn().mockImplementation((ctx: { err: () => unknown }) => {
    ctxs?.push(ctx);
    return new Promise<string>((resolve, reject) => {
      deferreds.push({ resolve, reject });
    });
  });
  return { execute, deferreds };
}

function createMockDI(overrides?: Partial<DIContainer>): DIContainer {
  return {
    getTranslationConfigUseCase: {
      execute: vi.fn().mockResolvedValue(defaultTranslationConfig),
    },
    getAiConfigsUseCase: {
      execute: vi.fn().mockResolvedValue({ aiConfigs: [] }),
    },
    translateTextUseCase: {
      execute: vi.fn().mockResolvedValue("翻译后的文本"),
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  } as unknown as DIContainer;
}

function createWrapper(mockDI: DIContainer) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <DIContext value={mockDI}>{children}</DIContext>;
  };
}

describe("useTranslation 文本翻译 Hook", () => {
  it("初始状态应为未翻译", () => {
    const mockDI = createMockDI();
    const wrapper = createWrapper(mockDI);

    const { result } = renderHook(() => useTranslation("hello"), { wrapper });

    expect(result.current.translatedText).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isTranslated).toBe(false);
    expect(result.current.showingOriginal).toBe(false);
  });

  it("调用 translate 后应返回翻译结果", async () => {
    const mockDI = createMockDI();
    const wrapper = createWrapper(mockDI);

    const { result } = renderHook(() => useTranslation("hello"), { wrapper });

    await act(async () => {
      await result.current.translate();
    });

    await waitFor(() => {
      expect(result.current.translatedText).toBe("翻译后的文本");
      expect(result.current.isTranslated).toBe(true);
      expect(result.current.loading).toBe(false);
    });
  });

  it("翻译空文本不应调用翻译服务", async () => {
    const execute = vi.fn().mockResolvedValue("");
    const mockDI = createMockDI({
      translateTextUseCase: { execute },
    } as unknown as Partial<DIContainer>);
    const wrapper = createWrapper(mockDI);

    const { result } = renderHook(() => useTranslation("   "), { wrapper });

    await act(async () => {
      await result.current.translate();
    });

    expect(execute).not.toHaveBeenCalled();
  });

  it("toggle 应切换 showingOriginal 状态", async () => {
    const mockDI = createMockDI();
    const wrapper = createWrapper(mockDI);

    const { result } = renderHook(() => useTranslation("hello"), { wrapper });

    await act(async () => {
      await result.current.translate();
    });

    expect(result.current.showingOriginal).toBe(false);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.showingOriginal).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.showingOriginal).toBe(false);
  });

  it("翻译失败时应设置 error 状态", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("网络错误"));
    const mockDI = createMockDI({
      translateTextUseCase: { execute },
    } as unknown as Partial<DIContainer>);
    const wrapper = createWrapper(mockDI);

    const { result } = renderHook(() => useTranslation("hello"), { wrapper });

    await act(async () => {
      await result.current.translate();
    });

    await waitFor(() => {
      expect(result.current.error?.message).toBe("网络错误");
      expect(result.current.loading).toBe(false);
    });
  });

  it("传入 options 时应覆盖设置中的目标语言与提供者", async () => {
    const execute = vi.fn().mockResolvedValue("bonjour");
    const mockDI = createMockDI({
      translateTextUseCase: { execute },
    } as unknown as Partial<DIContainer>);
    const wrapper = createWrapper(mockDI);

    const { result } = renderHook(
      () =>
        useTranslation("hello", {
          sourceLang: "en",
          targetLang: "fr",
          provider: "google",
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.translate();
    });

    expect(execute).toHaveBeenCalledWith(expect.anything(), {
      text: "hello",
      sourceLang: "en",
      targetLang: "fr",
      provider: "google",
      aiConfig: undefined,
    });
  });

  it("AI 翻译应传递匹配别名的 aiConfig", async () => {
    const translationConfig: TranslationConfig = {
      target_lang: "zh-CN",
      provider: "ai",
      ai_config_alias: "my-ai",
    };
    const aiConfigs = [
      { ...mockAiConfig, alias: NonEmptyStringSchema.parse("other-ai") },
      mockAiConfig,
    ];
    const execute = vi.fn().mockResolvedValue("AI 翻译结果");
    const mockDI = createMockDI({
      getTranslationConfigUseCase: {
        execute: vi.fn().mockResolvedValue(translationConfig),
      },
      getAiConfigsUseCase: {
        execute: vi.fn().mockResolvedValue({ aiConfigs }),
      },
      translateTextUseCase: { execute },
    } as unknown as Partial<DIContainer>);
    const wrapper = createWrapper(mockDI);

    const { result } = renderHook(() => useTranslation("hello"), { wrapper });

    await act(async () => {
      await result.current.translate();
    });

    expect(execute).toHaveBeenCalledWith(expect.anything(), {
      text: "hello",
      sourceLang: "auto",
      targetLang: "zh-CN",
      provider: "ai",
      aiConfig: mockAiConfig,
    });
  });

  it("AI 翻译未配置别名时不应传递 aiConfig", async () => {
    const translationConfig: TranslationConfig = {
      target_lang: "zh-CN",
      provider: "ai",
      ai_config_alias: null,
    };
    const execute = vi.fn().mockResolvedValue("AI 翻译结果");
    const mockDI = createMockDI({
      getTranslationConfigUseCase: {
        execute: vi.fn().mockResolvedValue(translationConfig),
      },
      getAiConfigsUseCase: {
        execute: vi.fn().mockResolvedValue({ aiConfigs: [mockAiConfig] }),
      },
      translateTextUseCase: { execute },
    } as unknown as Partial<DIContainer>);
    const wrapper = createWrapper(mockDI);

    const { result } = renderHook(() => useTranslation("hello"), { wrapper });

    await act(async () => {
      await result.current.translate();
    });

    expect(execute).toHaveBeenCalledWith(expect.anything(), {
      text: "hello",
      sourceLang: "auto",
      targetLang: "zh-CN",
      provider: "ai",
      aiConfig: undefined,
    });
  });

  it("AI 翻译没有可用的 AI 配置列表时不应传递 aiConfig", async () => {
    const translationConfig: TranslationConfig = {
      target_lang: "zh-CN",
      provider: "ai",
      ai_config_alias: "my-ai",
    };
    const execute = vi.fn().mockResolvedValue("AI 翻译结果");
    const mockDI = createMockDI({
      getTranslationConfigUseCase: {
        execute: vi.fn().mockResolvedValue(translationConfig),
      },
      getAiConfigsUseCase: {
        execute: vi.fn().mockResolvedValue({ aiConfigs: [] }),
      },
      translateTextUseCase: { execute },
    } as unknown as Partial<DIContainer>);
    const wrapper = createWrapper(mockDI);

    const { result } = renderHook(() => useTranslation("hello"), { wrapper });

    await act(async () => {
      await result.current.translate();
    });

    expect(execute).toHaveBeenCalledWith(expect.anything(), {
      text: "hello",
      sourceLang: "auto",
      targetLang: "zh-CN",
      provider: "ai",
      aiConfig: undefined,
    });
  });
  it("连续两次翻译应中止上一次请求且不写入旧结果", async () => {
    const { execute, deferreds } = createDeferredTranslate();
    const mockDI = createMockDI({
      translateTextUseCase: { execute },
    } as unknown as Partial<DIContainer>);
    const wrapper = createWrapper(mockDI);

    const { result } = renderHook(() => useTranslation("hello"), { wrapper });

    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.translate();
    });
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));

    act(() => {
      second = result.current.translate();
    });
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));

    // 上一次请求已中止：即使 resolve 也不应写入状态或重置 loading
    await act(async () => {
      deferreds[0].resolve("第一次结果");
      await first;
    });
    expect(result.current.translatedText).toBeNull();
    expect(result.current.loading).toBe(true);

    await act(async () => {
      deferreds[1].resolve("第二次结果");
      await second;
    });
    expect(result.current.translatedText).toBe("第二次结果");
    expect(result.current.loading).toBe(false);
  });

  it("被中止的翻译失败时不应设置错误状态", async () => {
    const { execute, deferreds } = createDeferredTranslate();
    const mockDI = createMockDI({
      translateTextUseCase: { execute },
    } as unknown as Partial<DIContainer>);
    const wrapper = createWrapper(mockDI);

    const { result } = renderHook(() => useTranslation("hello"), { wrapper });

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.translate();
    });
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.translate();
    });
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));

    await act(async () => {
      deferreds[0].reject(new Error("第一次失败"));
      await first;
    });
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it("非 Error 异常应包装为 Error", async () => {
    const execute = vi.fn().mockRejectedValue("boom");
    const mockDI = createMockDI({
      translateTextUseCase: { execute },
    } as unknown as Partial<DIContainer>);
    const wrapper = createWrapper(mockDI);

    const { result } = renderHook(() => useTranslation("hello"), { wrapper });

    await act(async () => {
      await result.current.translate();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("boom");
    expect(result.current.loading).toBe(false);
  });
  it("卸载组件应中止进行中的翻译且迟到结果不写入状态", async () => {
    const ctxs: Array<{ err: () => unknown }> = [];
    const { execute, deferreds } = createDeferredTranslate(ctxs);
    const mockDI = createMockDI({
      translateTextUseCase: { execute },
    } as unknown as Partial<DIContainer>);
    const wrapper = createWrapper(mockDI);

    const { result, unmount } = renderHook(() => useTranslation("hello"), {
      wrapper,
    });

    act(() => {
      result.current.translate();
    });
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));

    unmount();
    expect(ctxs[0].err()).toBe(Canceled);

    // 中止后迟到的结果不应写入状态
    await act(async () => {
      deferreds[0].resolve("迟到结果");
    });
    expect(result.current.translatedText).toBeNull();
  });

  it("卸载后获取设置完成时不应继续执行翻译", async () => {
    let resolveTranslationConfig!: (value: TranslationConfig) => void;
    const getTranslationConfigExecute = vi.fn().mockImplementation(
      () =>
        new Promise<TranslationConfig>((resolve) => {
          resolveTranslationConfig = resolve;
        }),
    );
    const execute = vi.fn();
    const mockDI = createMockDI({
      getTranslationConfigUseCase: { execute: getTranslationConfigExecute },
      translateTextUseCase: { execute },
    } as unknown as Partial<DIContainer>);
    const wrapper = createWrapper(mockDI);

    const { result, unmount } = renderHook(() => useTranslation("hello"), {
      wrapper,
    });

    act(() => {
      result.current.translate();
    });
    await act(async () => {});

    unmount();
    await act(async () => {
      resolveTranslationConfig(defaultTranslationConfig);
    });

    expect(execute).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });
});

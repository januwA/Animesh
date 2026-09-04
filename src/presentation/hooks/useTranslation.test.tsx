import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIContext } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig, Settings } from "@/domain/settings/SettingsSchemas";
import { useTranslation } from "./useTranslation";

const mockSettings: Settings = {
  download_dir: "/downloads",
  proxy: null,
  ai_configs: null,
  max_download_speed: null,
  max_upload_speed: null,
  translation: {
    target_lang: "zh-CN",
    provider: "google",
    ai_config_alias: null,
  },
};

const mockAiConfig: AiConfig = {
  alias: NonEmptyStringSchema.parse("my-ai"),
  api_endpoint: NonEmptyStringSchema.parse("https://api.example.com/v1"),
  api_key: NonEmptyStringSchema.parse("sk-test"),
  ai_model: NonEmptyStringSchema.parse("gpt-4o"),
};

/** 创建自定义翻译配置的设置 */
function createSettings(
  translation: Settings["translation"],
  aiConfigs: Settings["ai_configs"] = null,
): Settings {
  return { ...mockSettings, ai_configs: aiConfigs, translation };
}

/** 创建可手动控制 resolve/reject 的翻译用例 mock */
function createDeferredTranslate() {
  const deferreds: Array<{
    resolve: (value: string) => void;
    reject: (reason?: unknown) => void;
  }> = [];
  const execute = vi.fn().mockImplementation(
    () =>
      new Promise<string>((resolve, reject) => {
        deferreds.push({ resolve, reject });
      }),
  );
  return { execute, deferreds };
}

function createMockDI(overrides?: Partial<DIContainer>): DIContainer {
  return {
    getSettingsUseCase: {
      execute: vi.fn().mockResolvedValue(mockSettings),
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
    const settings = createSettings(
      { target_lang: "zh-CN", provider: "ai", ai_config_alias: "my-ai" },
      [
        { ...mockAiConfig, alias: NonEmptyStringSchema.parse("other-ai") },
        mockAiConfig,
      ],
    );
    const execute = vi.fn().mockResolvedValue("AI 翻译结果");
    const mockDI = createMockDI({
      getSettingsUseCase: { execute: vi.fn().mockResolvedValue(settings) },
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
    const settings = createSettings(
      { target_lang: "zh-CN", provider: "ai", ai_config_alias: null },
      [mockAiConfig],
    );
    const execute = vi.fn().mockResolvedValue("AI 翻译结果");
    const mockDI = createMockDI({
      getSettingsUseCase: { execute: vi.fn().mockResolvedValue(settings) },
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

  it("AI 翻译但没有可用的 AI 配置列表时不应传递 aiConfig", async () => {
    const settings = createSettings({
      target_lang: "zh-CN",
      provider: "ai",
      ai_config_alias: "my-ai",
    });
    const execute = vi.fn().mockResolvedValue("AI 翻译结果");
    const mockDI = createMockDI({
      getSettingsUseCase: { execute: vi.fn().mockResolvedValue(settings) },
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

  it("AbortError 异常不应设置错误状态", async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(new DOMException("已中止", "AbortError"));
    const mockDI = createMockDI({
      translateTextUseCase: { execute },
    } as unknown as Partial<DIContainer>);
    const wrapper = createWrapper(mockDI);

    const { result } = renderHook(() => useTranslation("hello"), { wrapper });

    await act(async () => {
      await result.current.translate();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.translatedText).toBeNull();
    expect(result.current.loading).toBe(false);
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
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    const { execute, deferreds } = createDeferredTranslate();
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
    expect(abortSpy).toHaveBeenCalled();

    // 中止后迟到的结果不应写入状态
    await act(async () => {
      deferreds[0].resolve("迟到结果");
    });
    expect(result.current.translatedText).toBeNull();

    abortSpy.mockRestore();
  });

  it("卸载后获取设置完成时不应继续执行翻译", async () => {
    let resolveSettings!: (value: Settings) => void;
    const getSettingsExecute = vi.fn().mockImplementation(
      () =>
        new Promise<Settings>((resolve) => {
          resolveSettings = resolve;
        }),
    );
    const execute = vi.fn();
    const mockDI = createMockDI({
      getSettingsUseCase: { execute: getSettingsExecute },
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
      resolveSettings(mockSettings);
    });

    expect(execute).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });
});

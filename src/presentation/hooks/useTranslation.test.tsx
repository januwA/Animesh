import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIContext } from "@/di/DIContext";
import { useTranslation } from "./useTranslation";

const mockSettings = {
  download_dir: "/downloads",
  proxy: null,
  ai_configs: null,
  max_download_speed: null,
  max_upload_speed: null,
  translation: {
    target_lang: "zh-CN",
    provider: "google" as const,
    ai_config_alias: null,
  },
};

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
});

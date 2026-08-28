import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIContext } from "@/di/DIContext";
import { TranslatableText } from "./TranslatableText";

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

function renderWithDI(
  ui: React.ReactElement,
  mockDI: DIContainer = createMockDI(),
) {
  return render(<DIContext value={mockDI}>{ui}</DIContext>);
}

describe("TranslatableText 可翻译文本组件", () => {
  it("应渲染原始文本和翻译按钮", () => {
    renderWithDI(<TranslatableText text="Hello, world!" />);

    expect(screen.getByText("Hello, world!")).toBeInTheDocument();
    expect(screen.getByText("翻译")).toBeInTheDocument();
  });

  it("点击翻译按钮后应显示翻译结果", async () => {
    renderWithDI(<TranslatableText text="Hello, world!" />);

    fireEvent.click(screen.getByText("翻译"));

    await waitFor(() => {
      expect(screen.getByText("翻译后的文本")).toBeInTheDocument();
      expect(screen.getByText("查看原文")).toBeInTheDocument();
    });
  });

  it("点击查看原文应切换回原文", async () => {
    renderWithDI(<TranslatableText text="Hello, world!" />);

    fireEvent.click(screen.getByText("翻译"));

    await waitFor(() => {
      expect(screen.getByText("查看原文")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("查看原文"));

    await waitFor(() => {
      expect(screen.getByText("Hello, world!")).toBeInTheDocument();
      expect(screen.getByText("查看翻译")).toBeInTheDocument();
    });
  });

  it("空文本时翻译按钮应禁用", () => {
    renderWithDI(<TranslatableText text="   " />);

    const button = screen.getByText("翻译").closest("button");
    expect(button).toBeDisabled();
  });

  it("翻译失败时应显示错误信息", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("网络错误"));
    const mockDI = createMockDI({
      translateTextUseCase: { execute },
    } as unknown as Partial<DIContainer>);

    renderWithDI(<TranslatableText text="Hello" />, mockDI);

    fireEvent.click(screen.getByText("翻译"));

    await waitFor(() => {
      expect(screen.getByText("网络错误")).toBeInTheDocument();
    });
  });

  it("应支持自定义 HTML 标签", () => {
    renderWithDI(<TranslatableText text="Hello" as="span" />);

    const span = screen.getByText("Hello");
    expect(span.tagName).toBe("SPAN");
  });
});

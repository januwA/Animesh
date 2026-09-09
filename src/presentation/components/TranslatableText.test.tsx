// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseTranslationResult } from "@/presentation/hooks/useTranslation";
import { useTranslation } from "@/presentation/hooks/useTranslation";
import { sanitizeHtml } from "@/presentation/lib/sanitizeHtml";
import { TranslatableText } from "./TranslatableText";

// DOMPurify 的净化规则已由 sanitizeHtml.test.ts 单独覆盖，组件测试只验证
// 「渲染前会调用 sanitizeHtml」这一自身行为，不再重复断言第三方净化细节。
vi.mock(import("@/presentation/lib/sanitizeHtml"), () => ({
  sanitizeHtml: vi.fn((rawHtml: string) => `[净化后]${rawHtml}`),
}));

// useTranslation 的内部逻辑由其自身单测覆盖，组件测试只 mock 该 hook，
// 只验证 TranslatableText 的渲染逻辑与用户交互行为。
vi.mock(import("@/presentation/hooks/useTranslation"), () => ({
  useTranslation: vi.fn(),
}));

const sanitizeHtmlMock = vi.mocked(sanitizeHtml);
const useTranslationMock = vi.mocked(useTranslation);

/** 构造 useTranslation 的桩返回值 */
function mockTranslation(
  overrides: Partial<UseTranslationResult> = {},
): UseTranslationResult {
  return {
    translatedText: null,
    loading: false,
    error: null,
    isTranslated: false,
    translate: vi.fn(),
    toggle: vi.fn(),
    showingOriginal: false,
    ...overrides,
  };
}

describe("TranslatableText 可翻译文本组件", () => {
  beforeEach(() => {
    sanitizeHtmlMock.mockClear();
    useTranslationMock.mockReset();
    useTranslationMock.mockReturnValue(mockTranslation());
  });

  it("应渲染原始文本和翻译按钮", () => {
    render(<TranslatableText text="Hello, world!" />);

    expect(screen.getByText("Hello, world!")).toBeInTheDocument();
    expect(screen.getByText("翻译")).toBeInTheDocument();
  });

  it("点击翻译按钮应调用 useTranslation 的 translate", () => {
    render(<TranslatableText text="Hello, world!" />);

    fireEvent.click(screen.getByText("翻译"));

    expect(
      useTranslationMock.mock.results[0].value.translate,
    ).toHaveBeenCalledTimes(1);
  });

  it("已翻译时应显示译文与查看原文按钮", () => {
    useTranslationMock.mockReturnValue(
      mockTranslation({
        translatedText: "翻译后的文本",
        isTranslated: true,
      }),
    );
    render(<TranslatableText text="Hello, world!" />);

    expect(screen.getByText("翻译后的文本")).toBeInTheDocument();
    expect(screen.getByText("查看原文")).toBeInTheDocument();
    expect(screen.queryByText("翻译")).not.toBeInTheDocument();
  });

  it("点击查看原文应调用 useTranslation 的 toggle", () => {
    useTranslationMock.mockReturnValue(
      mockTranslation({
        translatedText: "翻译后的文本",
        isTranslated: true,
      }),
    );
    render(<TranslatableText text="Hello, world!" />);

    fireEvent.click(screen.getByText("查看原文"));

    expect(
      useTranslationMock.mock.results[0].value.toggle,
    ).toHaveBeenCalledTimes(1);
  });

  it("显示原文状态时不渲染译文按钮", () => {
    useTranslationMock.mockReturnValue(
      mockTranslation({
        translatedText: "翻译后的文本",
        isTranslated: true,
        showingOriginal: true,
      }),
    );
    render(<TranslatableText text="Hello, world!" />);

    expect(screen.getByText("Hello, world!")).toBeInTheDocument();
    expect(screen.getByText("查看翻译")).toBeInTheDocument();
  });

  it("loading 状态应渲染禁用且不可点击的翻译中按钮", () => {
    useTranslationMock.mockReturnValue(
      mockTranslation({
        loading: true,
      }),
    );
    render(<TranslatableText text="Hello, world!" />);

    const button = screen.getByText("翻译中...").closest("button");
    expect(button).toBeDisabled();
  });
  it("空文本时翻译按钮应禁用", () => {
    render(<TranslatableText text="   " />);

    const button = screen.getByText("翻译").closest("button");
    expect(button).toBeDisabled();
  });

  it("翻译失败时应显示错误信息", () => {
    useTranslationMock.mockReturnValue(
      mockTranslation({ error: new Error("网络错误") }),
    );
    render(<TranslatableText text="Hello" />);

    expect(screen.getByText("网络错误")).toBeInTheDocument();
  });

  it("应支持自定义 HTML 标签", () => {
    render(<TranslatableText text="Hello" as="span" />);

    const span = screen.getByText("Hello");
    expect(span.tagName).toBe("SPAN");
  });
  it("renderHtml 时把净化后的内容用于渲染", () => {
    sanitizeHtmlMock.mockReturnValue("<p>净化后的文本</p>");
    render(<TranslatableText renderHtml text="<b>原文</b>" />);

    expect(sanitizeHtmlMock).toHaveBeenCalledWith("<b>原文</b>");
    expect(screen.getByText("净化后的文本")).toBeInTheDocument();
  });

  it("未开启 renderHtml 时不应调用 sanitizeHtml", () => {
    render(<TranslatableText text="纯文本" />);

    expect(sanitizeHtmlMock).not.toHaveBeenCalled();
  });

  it("renderHtml 时译文渲染前同样调用 sanitizeHtml", () => {
    sanitizeHtmlMock.mockReturnValue("<p>净化后的译文</p>");
    useTranslationMock.mockReturnValue(
      mockTranslation({
        translatedText: "翻译后的文本",
        isTranslated: true,
      }),
    );
    render(<TranslatableText renderHtml text="原文" />);

    expect(screen.getByText("净化后的译文")).toBeInTheDocument();
    expect(sanitizeHtmlMock).toHaveBeenLastCalledWith("翻译后的文本");
  });

  it("displayText 不变时重渲染不应重复调用 sanitizeHtml（引用缓存）", () => {
    sanitizeHtmlMock.mockReturnValue("<p>净化后的文本</p>");
    const { rerender } = render(
      <TranslatableText renderHtml text="<b>原文</b>" />,
    );

    expect(sanitizeHtmlMock).toHaveBeenCalledTimes(1);

    // 模拟父层无关重渲染：text 与状态均未变化
    rerender(<TranslatableText renderHtml text="<b>原文</b>" />);

    expect(sanitizeHtmlMock).toHaveBeenCalledTimes(1);
  });
});

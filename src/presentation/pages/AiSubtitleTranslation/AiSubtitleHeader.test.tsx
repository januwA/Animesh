import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AiSubtitleHeader } from "./AiSubtitleHeader";

const renderHeader = (props: Parameters<typeof AiSubtitleHeader>[0]) => {
  return render(<AiSubtitleHeader {...props} />, {
    wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
  });
};

describe("AiSubtitleHeader 页头组件", () => {
  it("应该渲染标题、视频名与说明文字", () => {
    renderHeader({ fileName: "Episode 1", onBack: vi.fn() });

    expect(screen.getByText("AI 字幕翻译")).toBeInTheDocument();
    expect(screen.getByText("Episode 1")).toBeInTheDocument();
    expect(
      screen.getByText(/选择原始字幕轨道，使用配置好的 AI/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
  });

  it("点击返回按钮时应该调用 onBack", () => {
    const onBack = vi.fn();
    renderHeader({ fileName: "Episode 1", onBack });

    fireEvent.click(screen.getByRole("button", { name: "返回" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

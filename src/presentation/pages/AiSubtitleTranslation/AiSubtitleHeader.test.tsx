import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiSubtitleHeader } from "./AiSubtitleHeader";

describe("AiSubtitleHeader 页头组件", () => {
  it("应该渲染标题、视频名与说明文字", () => {
    render(<AiSubtitleHeader title="Episode 1" onBack={vi.fn()} />);

    expect(screen.getByText("AI 字幕翻译")).toBeInTheDocument();
    expect(screen.getByText("Episode 1")).toBeInTheDocument();
    expect(
      screen.getByText(/选择原始字幕轨道，使用配置好的 AI/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "返回播放器" }),
    ).toBeInTheDocument();
  });

  it("点击返回按钮时应该调用 onBack", () => {
    const onBack = vi.fn();
    render(<AiSubtitleHeader title="Episode 1" onBack={onBack} />);

    fireEvent.click(screen.getByRole("button", { name: "返回播放器" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AiSubtitleHeader } from "./AiSubtitleHeader";

const renderHeader = (props: Parameters<typeof AiSubtitleHeader>[0]) => {
  return render(<AiSubtitleHeader {...props} />, {
    wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
  });
};

describe("AiSubtitleHeader 页头组件", () => {
  it("应该渲染标题、视频名与说明文字", () => {
    renderHeader({ fileName: "Episode 1" });

    expect(screen.getByText("AI 字幕翻译")).toBeInTheDocument();
    expect(screen.getByText("Episode 1")).toBeInTheDocument();
    expect(
      screen.getByText(/选择原始字幕轨道，使用配置好的 AI/),
    ).toBeInTheDocument();
  });
});

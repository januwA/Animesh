import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { ChapterInfo } from "@/domain/torrent/TorrentSchemas";
import { ChaptersSection } from "./ChaptersSection";
import { JsPlayer } from "./player";

const wrapWithProvider = (node: ReactNode) => (
  <JsPlayer.Provider>{node}</JsPlayer.Provider>
);

describe("ChaptersSection 章节列表组件", () => {
  const chapters: ChapterInfo[] = [
    { start_ms: 0, end_ms: 1000, title: "开场", language: "jpn" },
    { start_ms: 3661000, end_ms: null, title: "正片", language: "jpn" },
  ];

  it("没有章节时应该渲染为空", () => {
    const { container } = render(
      wrapWithProvider(<ChaptersSection chapters={[]} />),
    );

    expect(container.innerHTML).toBe("");
  });

  it("应该渲染章节标题与数量徽标", () => {
    render(wrapWithProvider(<ChaptersSection chapters={chapters} />));

    expect(screen.getByText("章节")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("展开后应该渲染所有章节按钮", () => {
    render(wrapWithProvider(<ChaptersSection chapters={chapters} />));

    const trigger = screen.getByText("章节").closest("button");
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger!);

    expect(screen.getByText("开场")).toBeInTheDocument();
    expect(screen.getByText("正片")).toBeInTheDocument();
  });
});

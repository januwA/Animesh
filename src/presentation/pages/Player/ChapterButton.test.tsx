import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { vi } from "vitest";
import type { ChapterInfo } from "@/domain/torrent/TorrentSchemas";
import { ChapterButton } from "./ChapterButton";
import { JsPlayer } from "./player";

const wrapWithProvider = (node: ReactNode) => (
  <JsPlayer.Provider>{node}</JsPlayer.Provider>
);

describe("ChapterButton 章节按钮组件", () => {
  const chapter: ChapterInfo = {
    start_ms: 3661000,
    end_ms: null,
    title: "正片",
    language: "jpn",
  };

  afterEach(() => {
    const vjsMock = (globalThis as any).__vjsMock;
    vjsMock.seek = vi.fn(() => Promise.resolve(0));
  });

  it("应该渲染章节序号、标题与格式化后的时间", () => {
    render(wrapWithProvider(<ChapterButton chapter={chapter} index={0} />));

    expect(screen.getByText("正片")).toBeInTheDocument();
    expect(screen.getByText("01:01:01")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("点击按钮时应该跳转到章节对应时间", async () => {
    render(wrapWithProvider(<ChapterButton chapter={chapter} index={0} />));

    const vjsMock = (globalThis as any).__vjsMock;
    const seekSpy = vi.spyOn(vjsMock, "seek");

    const button = screen.getByText("正片").closest("button");
    expect(button).not.toBeNull();
    await act(async () => {
      fireEvent.click(button!);
    });

    expect(seekSpy).toHaveBeenCalledWith(3661);
  });

  it("章节跳转失败时应该显示错误提示", async () => {
    render(wrapWithProvider(<ChapterButton chapter={chapter} index={0} />));

    const vjsMock = (globalThis as any).__vjsMock;
    vjsMock.seek = vi.fn(() => Promise.reject(new Error("seek failed")));

    const button = screen.getByText("正片").closest("button");
    expect(button).not.toBeNull();
    await act(async () => {
      fireEvent.click(button!);
      await vi.waitFor(() => expect(vjsMock.seek).toHaveBeenCalled());
    });

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("跳转到章节失败");
  });
});

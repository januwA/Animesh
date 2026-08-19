import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AddTorrentResult } from "@/domain/torrent/TorrentSchemas";
import { TorrentDetailContent } from "./TorrentDetailContent";

const makeTorrent = (): AddTorrentResult => ({
  info_hash: NonEmptyStringSchema.parse("hash123"),
  name: NonEmptyStringSchema.parse("测试种子"),
  files: [
    { id: 0, name: NonEmptyStringSchema.parse("file1.mp4"), len: 1000 },
    { id: 1, name: NonEmptyStringSchema.parse("file2.mkv"), len: 2000 },
  ],
});

describe("TorrentDetailContent 种子详情内容组件", () => {
  it("加载中时应该显示加载动画", () => {
    render(
      <TorrentDetailContent
        torrent={null}
        loading={true}
        error={null}
        onRetry={vi.fn()}
        onPlay={vi.fn()}
      />,
    );

    expect(
      screen.getByText("正在启动下载引擎并解析种子..."),
    ).toBeInTheDocument();
  });

  it("出错时应该显示错误状态", () => {
    render(
      <TorrentDetailContent
        torrent={null}
        loading={false}
        error={new Error("解析失败")}
        onRetry={vi.fn()}
        onPlay={vi.fn()}
      />,
    );

    expect(screen.getByText("种子解析失败")).toBeInTheDocument();
    expect(screen.getByText("解析失败")).toBeInTheDocument();
  });

  it("没有数据时应该显示空状态", () => {
    render(
      <TorrentDetailContent
        torrent={null}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        onPlay={vi.fn()}
      />,
    );

    expect(screen.getByText("未找到种子数据")).toBeInTheDocument();
  });

  it("有数据时应该渲染种子名称和文件列表", () => {
    const torrent = makeTorrent();
    render(
      <TorrentDetailContent
        torrent={torrent}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        onPlay={vi.fn()}
      />,
    );

    expect(screen.getByText("测试种子")).toBeInTheDocument();
    expect(screen.getByText("file1.mp4")).toBeInTheDocument();
    expect(screen.getByText("file2.mkv")).toBeInTheDocument();
    expect(screen.getByText("共 2 个文件")).toBeInTheDocument();
  });

  it("点击重试按钮应该调用 onRetry", () => {
    const onRetry = vi.fn();
    render(
      <TorrentDetailContent
        torrent={null}
        loading={false}
        error={new Error("解析失败")}
        onRetry={onRetry}
        onPlay={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("点击播放按钮应该调用 onPlay", () => {
    const onPlay = vi.fn();
    const torrent = makeTorrent();
    render(
      <TorrentDetailContent
        torrent={torrent}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        onPlay={onPlay}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "播放" })[0]);
    expect(onPlay).toHaveBeenCalledWith("hash123", 0, "file1.mp4");
  });
});

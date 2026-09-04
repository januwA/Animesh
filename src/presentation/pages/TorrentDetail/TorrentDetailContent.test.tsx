import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AddTorrentResult } from "@/domain/torrent/TorrentSchemas";
import { TorrentDetailContent } from "./TorrentDetailContent";

const makeTorrent = (): AddTorrentResult => ({
  info_hash: NonEmptyStringSchema.parse("hash123"),
  files: [
    {
      id: 0,
      name: NonEmptyStringSchema.parse("file1.mp4"),
      len: 1000,
      included: true,
    },
    {
      id: 1,
      name: NonEmptyStringSchema.parse("file2.mkv"),
      len: 2000,
      included: true,
    },
  ],
});

const defaultProps = {
  torrent: null as AddTorrentResult | null,
  loading: false,
  error: null as Error | null,
  selectedIds: new Set<number>(),
  initialized: false,
  confirming: false,
  onRetry: vi.fn(),
  onPlay: vi.fn(),
  onToggleFile: vi.fn(),
  onToggleAll: vi.fn(),
  onConfirmSelection: vi.fn(),
};

describe("TorrentDetailContent 种子详情内容组件", () => {
  it("加载中时应该显示加载动画", () => {
    render(<TorrentDetailContent {...defaultProps} loading={true} />);

    expect(
      screen.getByText("正在启动下载引擎并解析种子..."),
    ).toBeInTheDocument();
  });

  it("出错时应该显示错误状态", () => {
    render(
      <TorrentDetailContent {...defaultProps} error={new Error("解析失败")} />,
    );

    expect(screen.getByText("种子解析失败")).toBeInTheDocument();
    expect(screen.getByText("解析失败")).toBeInTheDocument();
  });

  it("没有数据时应该显示空状态", () => {
    render(<TorrentDetailContent {...defaultProps} />);

    expect(screen.getByText("未找到种子数据")).toBeInTheDocument();
  });

  it("有数据时应该渲染种子名称和文件列表", () => {
    const torrent = makeTorrent();
    render(
      <TorrentDetailContent
        {...defaultProps}
        torrent={torrent}
        selectedIds={new Set([0, 1])}
        initialized={true}
      />,
    );

    expect(screen.getByText("file1.mp4")).toBeInTheDocument();
    expect(screen.getByText("file2.mkv")).toBeInTheDocument();
    expect(screen.getByText("共 2 个文件，已选 2 个")).toBeInTheDocument();
  });

  it("点击重试按钮应该调用 onRetry", () => {
    const onRetry = vi.fn();
    render(
      <TorrentDetailContent
        {...defaultProps}
        error={new Error("解析失败")}
        onRetry={onRetry}
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
        {...defaultProps}
        torrent={torrent}
        selectedIds={new Set([0, 1])}
        initialized={true}
        onPlay={onPlay}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "播放" })[0]);
    expect(onPlay).toHaveBeenCalledWith("hash123", 0, "file1.mp4");
  });

  it("点击文件勾选框应该调用 onToggleFile", () => {
    const onToggleFile = vi.fn();
    const torrent = makeTorrent();
    render(
      <TorrentDetailContent
        {...defaultProps}
        torrent={torrent}
        selectedIds={new Set([0, 1])}
        initialized={true}
        onToggleFile={onToggleFile}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);
    expect(onToggleFile).toHaveBeenCalledWith(0);
  });

  it("点击全选应该调用 onToggleAll", () => {
    const onToggleAll = vi.fn();
    const torrent = makeTorrent();
    render(
      <TorrentDetailContent
        {...defaultProps}
        torrent={torrent}
        selectedIds={new Set([0, 1])}
        initialized={true}
        onToggleAll={onToggleAll}
      />,
    );

    const selectAllCheckbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(selectAllCheckbox);
    expect(onToggleAll).toHaveBeenCalledWith(torrent.files);
  });

  it("未选择文件时确认按钮应该禁用", () => {
    const torrent = makeTorrent();
    render(
      <TorrentDetailContent
        {...defaultProps}
        torrent={torrent}
        selectedIds={new Set()}
        initialized={true}
      />,
    );

    expect(screen.getByRole("button", { name: "确认选择" })).toBeDisabled();
  });

  it("点击确认按钮应该调用 onConfirmSelection", () => {
    const onConfirmSelection = vi.fn();
    const torrent = makeTorrent();
    render(
      <TorrentDetailContent
        {...defaultProps}
        torrent={torrent}
        selectedIds={new Set([0])}
        initialized={true}
        onConfirmSelection={onConfirmSelection}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "确认选择" }));
    expect(onConfirmSelection).toHaveBeenCalledOnce();
  });

  it("未选中的文件播放按钮应该禁用", () => {
    const onPlay = vi.fn();
    const torrent = makeTorrent();
    render(
      <TorrentDetailContent
        {...defaultProps}
        torrent={torrent}
        selectedIds={new Set([1])}
        initialized={true}
        onPlay={onPlay}
      />,
    );

    const playButtons = screen.getAllByRole("button", { name: "播放" });
    expect(playButtons[0]).toBeDisabled();
    expect(playButtons[1]).not.toBeDisabled();
  });
});

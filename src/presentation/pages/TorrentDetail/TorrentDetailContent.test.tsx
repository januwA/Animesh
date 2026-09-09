import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type {
  AddTorrentResult,
  TorrentStatusInfo,
} from "@/domain/torrent/TorrentSchemas";
import { TorrentDetailContent } from "./TorrentDetailContent";
import { useTorrentDetailPage } from "./useTorrentDetailPage";

vi.mock("./useTorrentDetailPage", () => ({
  useTorrentDetailPage: vi.fn(),
}));

const mockUseTorrentDetailPage = vi.mocked(useTorrentDetailPage);

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

const makeStatus = (
  overrides: Partial<TorrentStatusInfo> = {},
): TorrentStatusInfo => ({
  info_hash: NonEmptyStringSchema.parse("hash123"),
  name: NonEmptyStringSchema.parse("test torrent"),
  progress_bytes: 500,
  total_bytes: 1000,
  finished: false,
  download_speed_bytes_per_sec: 100,
  upload_speed_bytes_per_sec: 200,
  paused: false,
  peers_connected: 2,
  peers_total: 5,
  ...overrides,
});

const defaultHookReturn = () => ({
  torrent: null as AddTorrentResult | null,
  loading: false,
  error: null as Error | null,
  refetch: vi.fn(),
  selectedIds: new Set<number>(),
  confirming: false,
  toggleFile: vi.fn(),
  toggleAll: vi.fn(),
  confirmSelection: vi.fn(),
  handleStartPlayback: vi.fn(),
  status: null,
  downloadProgress: 0,
});

const renderContent = (
  overrides: Partial<ReturnType<typeof useTorrentDetailPage>> = {},
) => {
  mockUseTorrentDetailPage.mockReturnValue({
    ...defaultHookReturn(),
    ...overrides,
  });
  return render(
    <TorrentDetailContent magnet={NonEmptyStringSchema.parse("hash123")} />,
  );
};

describe("TorrentDetailContent 种子详情内容组件", () => {
  it("加载中且无数据时应该显示加载动画", () => {
    renderContent({ loading: true });

    expect(
      screen.getByText("正在启动下载引擎并解析种子..."),
    ).toBeInTheDocument();
  });

  it("出错且无数据时应该显示错误状态", () => {
    renderContent({ error: new Error("解析失败") });

    expect(screen.getByText("种子解析失败")).toBeInTheDocument();
    expect(screen.getByText("解析失败")).toBeInTheDocument();
  });

  it("没有数据时应该显示空状态", () => {
    renderContent();

    expect(screen.getByText("未找到种子数据")).toBeInTheDocument();
  });

  it("有数据时应该渲染种子名称和文件列表", () => {
    const torrent = makeTorrent();
    renderContent({ torrent, selectedIds: new Set([0, 1]) });

    expect(screen.getByText("file1.mp4")).toBeInTheDocument();
    expect(screen.getByText("file2.mkv")).toBeInTheDocument();
    expect(screen.getByText(/共 2 个文件/)).toBeInTheDocument();
    expect(screen.getByText(/已选 2 个/)).toBeInTheDocument();
  });

  it("出错时点击重试按钮应该调用 refetch", () => {
    const refetch = vi.fn();
    renderContent({ error: new Error("解析失败"), refetch });

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("点击播放按钮应该调用 handleStartPlayback", () => {
    const handleStartPlayback = vi.fn();
    const torrent = makeTorrent();
    renderContent({
      torrent,
      selectedIds: new Set([0, 1]),
      handleStartPlayback,
    });

    fireEvent.click(screen.getAllByRole("button", { name: "播放" })[0]);
    expect(handleStartPlayback).toHaveBeenCalledWith("hash123", 0, "file1.mp4");
  });

  it("点击文件勾选框应该调用 toggleFile", () => {
    const toggleFile = vi.fn();
    const torrent = makeTorrent();
    renderContent({ torrent, selectedIds: new Set([0, 1]), toggleFile });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);
    expect(toggleFile).toHaveBeenCalledWith(0);
  });

  it("点击全选应该调用 toggleAll", () => {
    const toggleAll = vi.fn();
    const torrent = makeTorrent();
    renderContent({ torrent, selectedIds: new Set([0, 1]), toggleAll });

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(toggleAll).toHaveBeenCalledWith(torrent.files);
  });

  it("未选择文件时确认按钮应该禁用", () => {
    const torrent = makeTorrent();
    renderContent({ torrent, selectedIds: new Set() });

    expect(screen.getByRole("button", { name: "确认选择" })).toBeDisabled();
  });

  it("点击确认按钮应该调用 confirmSelection", () => {
    const confirmSelection = vi.fn();
    const torrent = makeTorrent();
    renderContent({ torrent, selectedIds: new Set([0]), confirmSelection });

    fireEvent.click(screen.getByRole("button", { name: "确认选择" }));
    expect(confirmSelection).toHaveBeenCalledOnce();
  });

  it("未选中的文件播放按钮应该禁用", () => {
    const torrent = makeTorrent();
    renderContent({ torrent, selectedIds: new Set([1]) });

    const playButtons = screen.getAllByRole("button", { name: "播放" });
    expect(playButtons[0]).toBeDisabled();
    expect(playButtons[1]).not.toBeDisabled();
  });

  it("部分文件选中时全选框应处于半选状态", () => {
    const torrent = makeTorrent();
    renderContent({ torrent, selectedIds: new Set([0]) });

    const selectAllCheckbox = screen.getAllByRole("checkbox")[0];
    expect(selectAllCheckbox).toHaveAttribute("aria-checked", "mixed");
  });

  it("全部文件选中时全选框应为选中状态", () => {
    const torrent = makeTorrent();
    renderContent({ torrent, selectedIds: new Set([0, 1]) });

    const selectAllCheckbox = screen.getAllByRole("checkbox")[0];
    expect(selectAllCheckbox).toHaveAttribute("aria-checked", "true");
  });

  it("加载中但已有数据时(刷新)应保留列表而非显示加载", () => {
    const torrent = makeTorrent();
    renderContent({ torrent, loading: true, selectedIds: new Set([0, 1]) });

    expect(screen.queryByText("正在启动下载引擎并解析种子...")).toBeNull();
    expect(screen.getByText("file1.mp4")).toBeInTheDocument();
  });

  it("应向 useTorrentDetailPage 传入解析用的 magnet", () => {
    renderContent();

    expect(mockUseTorrentDetailPage).toHaveBeenCalledWith({
      magnet: "hash123",
      infoHash: undefined,
    });
  });

  it("confirming 为 true 时确认按钮内应显示加载动画", () => {
    const torrent = makeTorrent();
    renderContent({ torrent, selectedIds: new Set([0]), confirming: true });

    const confirmBtn = screen.getByRole("button", { name: "确认选择" });
    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("有 status 时应渲染下载进度与状态", () => {
    const torrent = makeTorrent();
    renderContent({
      torrent,
      status: makeStatus(),
      downloadProgress: 50,
    });

    expect(screen.getByText(/下载进度: 50.00%/)).toBeInTheDocument();
    expect(screen.getByText(/下载: 100 B\/s/)).toBeInTheDocument();
    expect(screen.getByText(/状态: 正在缓存/)).toBeInTheDocument();
  });

  it("status 为空时应渲染解析占位", () => {
    const torrent = makeTorrent();
    renderContent({ torrent });

    expect(
      screen.getByText(/正在解析种子元数据 \/ 等待任务初始化/),
    ).toBeInTheDocument();
  });

  it("status.finished 为 true 时应显示已完成", () => {
    const torrent = makeTorrent();
    renderContent({
      torrent,
      status: makeStatus({ finished: true }),
      downloadProgress: 100,
    });

    expect(screen.getByText(/状态: 已完成/)).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { DownloadStatsPanel } from "./DownloadStatsPanel";

const makeStatus = (
  overrides: Partial<TorrentStatusInfo> = {},
): TorrentStatusInfo => ({
  info_hash: NonEmptyStringSchema.parse("hash123"),
  name: NonEmptyStringSchema.parse("测试视频"),
  progress_bytes: 400,
  total_bytes: 1000,
  finished: false,
  download_speed_bytes_per_sec: 100,
  upload_speed_bytes_per_sec: 100,
  paused: false,
  peers_connected: 0,
  peers_total: 0,
  trackers: [],
  ...overrides,
});

describe("DownloadStatsPanel 下载统计面板组件", () => {
  it("没有种子状态时应该显示回退文本", () => {
    render(<DownloadStatsPanel torrentStatus={null} downloadProgress={0} />);

    expect(screen.getByText("下载进度: 计算中...")).toBeInTheDocument();
    expect(screen.getByText("下载: 0 B/s")).toBeInTheDocument();
    expect(screen.getByText("上传: 0 B/s")).toBeInTheDocument();
    expect(screen.getAllByText("0 B")).toHaveLength(2);
    expect(screen.getByText("0 / 0")).toBeInTheDocument();
    expect(screen.getByText("连接中...")).toBeInTheDocument();
  });

  it("有种子状态时应该显示进度与速度", () => {
    render(
      <DownloadStatsPanel torrentStatus={makeStatus()} downloadProgress={40} />,
    );

    expect(screen.getByText("下载进度: 40.00%")).toBeInTheDocument();
    expect(screen.getByText("下载: 100 B/s")).toBeInTheDocument();
    expect(screen.getByText("上传: 100 B/s (连接: 0/0)")).toBeInTheDocument();
    expect(screen.getByText("正在缓存...")).toBeInTheDocument();
    expect(screen.getByText("400 B")).toBeInTheDocument();
    expect(screen.getByText("1000 B")).toBeInTheDocument();
  });

  it("下载完成时应该显示已完成状态", () => {
    render(
      <DownloadStatsPanel
        torrentStatus={makeStatus({ finished: true, progress_bytes: 1000 })}
        downloadProgress={100}
      />,
    );

    expect(screen.getByText("下载进度: 100.00%")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
  });
});

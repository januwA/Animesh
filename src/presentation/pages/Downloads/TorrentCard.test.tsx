import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import type { TorrentCardProps } from "./TorrentCard";
import { TorrentCard } from "./TorrentCard";

const makeStatus = (
  overrides: Partial<TorrentStatusInfo> = {},
): TorrentStatusInfo => ({
  info_hash: NonEmptyStringSchema.parse("hash123"),
  name: NonEmptyStringSchema.parse("测试任务"),
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

const makeProps = (
  overrides: Partial<TorrentCardProps> = {},
): TorrentCardProps => ({
  torrent: makeStatus(),
  onViewFiles: vi.fn(),
  onTogglePause: vi.fn(),
  onDelete: vi.fn(),
  delLoading: false,
  pendingPauseHash: null,
  pendingResumeHash: null,
  pendingDeleteHash: null,
  ...overrides,
});

describe("TorrentCard 下载任务卡片组件", () => {
  it("应该渲染任务信息、速度与存储行，并支持查看文件", () => {
    const onViewFiles = vi.fn();
    const torrent = makeStatus({ created_at: 1719819600000 });
    render(<TorrentCard {...makeProps({ torrent, onViewFiles })} />);

    expect(screen.getByText("测试任务")).toBeInTheDocument();
    expect(screen.getByText(/创建时间:/)).toBeInTheDocument();
    expect(screen.getAllByText("100 B/s")).toHaveLength(2);
    expect(screen.getByText(/已下载:.*总大小:/)).toBeInTheDocument();
    expect(screen.getByText("(同伴: 0/0)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看文件" }));
    expect(onViewFiles).toHaveBeenCalledWith(torrent);
  });

  it("没有创建时间与总大小时应该回退，且非暂停按钮可点击", () => {
    const onTogglePause = vi.fn();
    const torrent = makeStatus({ created_at: undefined, total_bytes: 0 });
    render(<TorrentCard {...makeProps({ torrent, onTogglePause })} />);

    expect(screen.queryByText(/创建时间:/)).not.toBeInTheDocument();
    expect(screen.getByText(/已下载:.*总大小:/)).toBeInTheDocument();

    const pauseBtn = screen.getByTitle("暂停下载");
    expect(pauseBtn).not.toBeDisabled();
    fireEvent.click(pauseBtn);
    expect(onTogglePause).toHaveBeenCalledWith(torrent);
  });

  it("暂停状态应该显示开始按钮，恢复 pending 匹配时禁用", () => {
    const onTogglePause = vi.fn();
    const torrent = makeStatus({ paused: true });
    const { rerender } = render(
      <TorrentCard {...makeProps({ torrent, onTogglePause })} />,
    );

    const resumeBtn = screen.getByTitle("开始下载");
    expect(resumeBtn).not.toBeDisabled();
    fireEvent.click(resumeBtn);
    expect(onTogglePause).toHaveBeenCalledWith(torrent);

    rerender(
      <TorrentCard
        {...makeProps({ torrent, onTogglePause, pendingResumeHash: "hash123" })}
      />,
    );
    expect(screen.getByTitle("开始下载")).toBeDisabled();
  });

  it("非暂停任务在 pendingPauseHash 匹配时暂停按钮禁用", () => {
    render(<TorrentCard {...makeProps({ pendingPauseHash: "hash123" })} />);
    expect(screen.getByTitle("暂停下载")).toBeDisabled();
  });

  it("删除 pending 匹配时删除按钮禁用并显示加载图标", () => {
    const { rerender } = render(<TorrentCard {...makeProps()} />);
    expect(screen.getByTitle("删除下载")).not.toBeDisabled();

    rerender(<TorrentCard {...makeProps({ pendingDeleteHash: "hash123" })} />);
    expect(screen.getByTitle("删除下载")).toBeDisabled();
  });

  it("删除弹窗勾选后确认应携带删除文件参数", () => {
    const onDelete = vi.fn();
    const torrent = makeStatus();
    render(<TorrentCard {...makeProps({ torrent, onDelete })} />);

    fireEvent.click(screen.getByTitle("删除下载"));
    expect(screen.getByText("删除下载任务")).toBeInTheDocument();
    expect(screen.getByTestId("delete-dialog-torrent-name").textContent).toBe(
      "测试任务",
    );

    const checkbox = screen.getByLabelText(
      "同时删除已下载的本地缓存文件 (彻底释放磁盘空间)",
    );
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    expect(onDelete).toHaveBeenCalledWith(torrent, true);
  });

  it("删除弹窗重新打开时默认不勾选，确认应携带不删除文件", () => {
    const onDelete = vi.fn();
    const torrent = makeStatus();
    render(<TorrentCard {...makeProps({ torrent, onDelete })} />);

    fireEvent.click(screen.getByTitle("删除下载"));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    expect(onDelete).toHaveBeenCalledWith(torrent, false);
  });

  it("delLoading 时确认删除按钮应禁用", () => {
    render(<TorrentCard {...makeProps({ delLoading: true })} />);

    fireEvent.click(screen.getByTitle("删除下载"));
    expect(screen.getByRole("button", { name: "确认删除" })).toBeDisabled();
  });
});

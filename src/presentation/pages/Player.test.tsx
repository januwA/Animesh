import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import type { TorrentRepository } from "@/domain/torrent/TorrentRepository";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { createDIContainerForTest } from "@/test/test-utils";
import { NavBarLayout } from "../components/Layout";
import { AppContextProvider } from "../context/AppContext";
import { TorrentStatusProvider } from "../context/TorrentStatusContext";
import Player from "./Player";

// Mock clipboard API
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn(),
  },
  writable: true,
});

if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
}
if (typeof URL.revokeObjectURL === "undefined") {
  URL.revokeObjectURL = vi.fn();
}

const currentLocation = {
  current: null as { pathname: string; search: string } | null,
};
const LocationTracker = () => {
  currentLocation.current = useLocation();
  return null;
};
const getCurrentLocation = () => currentLocation.current;

describe("Player 页面组件", () => {
  let mockTorrentRepository: TorrentRepository;
  let mockContainer: DIContainer;

  beforeEach(() => {
    mockTorrentRepository = {
      search: vi.fn(),
      addTorrentMagnet: vi.fn(),
      getTorrentFiles: vi.fn(),
      listTorrents: vi.fn(),
      pauseTorrent: vi.fn(),
      resumeTorrent: vi.fn(),
      deleteTorrent: vi.fn(),
      getTorrentStreamUrl: vi.fn(),
      getTorrentStatus: vi.fn(),
      getSubtitleTracks: vi.fn(),
      getSubtitleVtt: vi.fn(),
      getVideoChapters: vi.fn(),
      subscribeTorrents: vi.fn().mockImplementation((onUpdate) => {
        const runInitial = async () => {
          try {
            const status = await mockTorrentRepository.getTorrentStatus("");
            if (status) onUpdate([status]);
          } catch {}
        };
        runInitial();

        const interval = setInterval(async () => {
          try {
            const status = await mockTorrentRepository.getTorrentStatus("");
            if (status) onUpdate([status]);
          } catch {}
        }, 1500);

        return Promise.resolve(() => clearInterval(interval));
      }),
    };

    mockContainer = createDIContainerForTest({
      torrentRepository: mockTorrentRepository,
    });

    currentLocation.current = null;
    vi.clearAllMocks();
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderPlayer = (
    initialEntry: string,
    initialEntries = [initialEntry],
  ) => {
    return render(
      <DIProvider value={mockContainer}>
        <TorrentStatusProvider>
          <AppContextProvider>
            <MemoryRouter
              initialEntries={initialEntries}
              initialIndex={initialEntries.indexOf(initialEntry)}
            >
              <LocationTracker />
              <Routes>
                <Route path="/" element={<NavBarLayout />}>
                  <Route path="play/:infoHash" element={<Player />} />
                  <Route path="play/:infoHash/:fileId" element={<Player />} />
                  <Route path="torrent" element={<div>Torrent Page</div>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </AppContextProvider>
        </TorrentStatusProvider>
      </DIProvider>,
    );
  };

  it("当缺少播放参数时，应该渲染参数错误提示", async () => {
    renderPlayer("/play/invalid");

    expect(screen.getByText("无效的视频播放参数")).toBeInTheDocument();
    expect(screen.getByText("文件 ID 必须是数字")).toBeInTheDocument();
  });

  it("应该成功初始化播放器并加载流地址与初始状态，并启动状态轮询", async () => {
    vi.useFakeTimers();

    const mockStatus = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    };

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
      mockStatus,
    );

    renderPlayer(
      "/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mp4",
    );

    // Resolve the initial mount microtasks and initialization invokes
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // Checks progress & stats
    expect(screen.getByText("video_name.mp4")).toBeInTheDocument();
    expect(screen.getByText("来自种子: test_title")).toBeInTheDocument();
    expect(screen.getByText("下载进度: 40.00%")).toBeInTheDocument();
    expect(screen.getByText("速度: 100 B/s (连接: 0/0)")).toBeInTheDocument();
    expect(screen.getByText("正在缓存...")).toBeInTheDocument();
    expect(screen.getByText("400 B")).toBeInTheDocument();
    expect(screen.getByText("1000 B")).toBeInTheDocument();

    const finishedStatus = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 1000,
      total_bytes: 1000,
      finished: true,
      download_speed_bytes_per_sec: 0,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    };
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
      finishedStatus,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.getByText("下载进度: 100.00%")).toBeInTheDocument();
    expect(
      screen.getByText("速度: 未知大小/s (连接: 0/0)"),
    ).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();

    // Polling error (should not crash page)
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockRejectedValueOnce(
      "Fetch status error",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.getByText("下载进度: 100.00%")).toBeInTheDocument();
  });

  it("当获取流地址失败时，应该显示错误提示和Toast", async () => {
    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockRejectedValueOnce(
      "Stream server port not initialized",
    );

    renderPlayer("/play/hash123/0");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("无法获取视频流"),
        { duration: 10000 },
      );
    });
  });

  it("当复制视频流地址时，应该支持成功和失败提示，并处理未加载完毕提前点击的情况", async () => {
    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockImplementation(
      () => new Promise(() => {}),
    );

    const { unmount } = renderPlayer(
      "/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mp4",
    );

    const copyBtn = screen.getByRole("button", { name: "复制视频流地址" });
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();

    unmount();

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "stream_url",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue({
      info_hash: "hash123",
      name: "视频",
      progress_bytes: 0,
      total_bytes: 100,
      finished: false,
      download_speed_bytes_per_sec: 0,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    });

    renderPlayer(
      "/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mp4",
    );

    await waitFor(() => {
      expect(screen.getByText("来自种子: test_title")).toBeInTheDocument();
    });

    vi.useFakeTimers();

    const copyBtnLoaded = screen.getByRole("button", {
      name: "复制视频流地址",
    });

    // Success path
    fireEvent.click(copyBtnLoaded);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("stream_url");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(toast.success).toHaveBeenCalledWith(
      "视频流地址已复制到剪贴板，可在外部播放器中播放",
    );

    // Failure path
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
      new Error("Clipboard block"),
    );
    fireEvent.click(copyBtnLoaded);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(toast.error).toHaveBeenCalledWith("复制失败，请手动复制");
  });

  it("当点击返回按钮时，应该能够返回上一页", async () => {
    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "stream_url",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue({
      info_hash: "hash123",
      name: "视频",
      progress_bytes: 0,
      total_bytes: 100,
      finished: false,
      download_speed_bytes_per_sec: 0,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    });

    // 1. Has magnet parameter in history
    const render1 = renderPlayer(
      "/play/hash123/0?magnet=magnet_url&title=title_val&fileName=file_val",
      [
        "/torrent?magnet=magnet_url",
        "/play/hash123/0?magnet=magnet_url&title=title_val&fileName=file_val",
      ],
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(getCurrentLocation()?.pathname).toBe("/torrent");

    render1.unmount();
    currentLocation.current = null;

    // 2. Does NOT have magnet parameter in history
    renderPlayer("/play/hash123/0?title=title_val", [
      "/torrent?infoHash=hash123",
      "/play/hash123/0?title=title_val",
    ]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(getCurrentLocation()?.pathname).toBe("/torrent");
  });

  it("在加载流地址和状态的过程中如果组件卸载，应该正常清理而不设置状态或启动定时器", async () => {
    let resolveUrlPromise: (value: string) => void = () => {};
    const urlPromise = new Promise<string>((resolve) => {
      resolveUrlPromise = resolve;
    });

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockReturnValue(
      urlPromise,
    );

    const { unmount } = renderPlayer("/play/hash123/0");

    unmount();

    await act(async () => {
      resolveUrlPromise("stream_url_value");
    });
  });

  it("在订阅建立的过程中如果组件被卸载，应该在订阅成功建立后立即执行取消订阅", async () => {
    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1/stream",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue({
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    });

    let resolveUnsubscribePromise: (value: any) => void = () => {};
    const unsubscribePromise = new Promise<any>((resolve) => {
      resolveUnsubscribePromise = resolve;
    });
    vi.mocked(mockTorrentRepository.subscribeTorrents).mockReturnValue(
      unsubscribePromise,
    );

    const { unmount } = renderPlayer("/play/hash123/0");

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    unmount();

    const mockUnsub = vi.fn();
    await act(async () => {
      resolveUnsubscribePromise(mockUnsub);
    });

    expect(mockUnsub).toHaveBeenCalled();
  });

  it("应该成功获取字幕轨道并惰性加载第一个字幕 VTT", async () => {
    vi.useFakeTimers();

    const mockStatus = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    };

    const mockSubtracks = [
      { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
      { id: 2, language: "chi", title: "Chinese", codec: "S_TEXT/ASS" },
      { id: 3, language: "", title: "", codec: "S_TEXT/UTF8" },
    ];

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
      mockStatus,
    );
    vi.mocked(mockTorrentRepository.getSubtitleTracks).mockResolvedValue(
      mockSubtracks,
    );
    vi.mocked(mockTorrentRepository.getSubtitleVtt).mockResolvedValue(
      "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello World\n",
    );

    renderPlayer(
      "/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mkv",
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // Only the first subtitle VTT is preloaded initially (lazy loading)
    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledTimes(1);
    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledWith(
      "hash123",
      0,
      1,
    );
  });

  it("当获取字幕轨道列表失败时，应该优雅处理并打印错误", async () => {
    vi.useFakeTimers();
    const mockStatus = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    };

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
      mockStatus,
    );
    vi.mocked(mockTorrentRepository.getSubtitleTracks).mockRejectedValue(
      new Error("Failed to load tracks"),
    );

    renderPlayer(
      "/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mp4",
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // Trigger the interval and wait for the polling catch block to execute
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    vi.useRealTimers();
  });

  it("当获取字幕VTT失败时，应该显示错误Toast提示", async () => {
    const mockStatus = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    };

    const mockSubtracks = [
      { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
    ];

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
      mockStatus,
    );
    vi.mocked(mockTorrentRepository.getSubtitleTracks).mockResolvedValue(
      mockSubtracks,
    );
    vi.mocked(mockTorrentRepository.getSubtitleVtt).mockRejectedValue(
      new Error("VTT load error"),
    );

    renderPlayer(
      "/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mp4",
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("加载字幕失败"),
      );
    });
  });

  it("在初始加载失败后，应该在轮询中成功加载字幕轨道", async () => {
    vi.useFakeTimers();
    const mockStatus = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    };

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
      mockStatus,
    );
    vi.mocked(mockTorrentRepository.getSubtitleVtt).mockResolvedValue(
      "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello World\n",
    );

    // First call fails, second call (polling) succeeds
    const mockSubtracks = [
      { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
    ];
    vi.mocked(mockTorrentRepository.getSubtitleTracks)
      .mockRejectedValueOnce(new Error("First try fails"))
      .mockResolvedValueOnce(mockSubtracks);

    renderPlayer(
      "/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mp4",
    );

    // Flush initialization microtasks
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Advance timers to trigger the polling which will succeed
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    // Flush microtasks
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    }

    // Verify subtitle VTT was loaded after polling succeeded
    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledWith(
      "hash123",
      0,
      1,
    );

    vi.useRealTimers();
  });

  it("当字幕轨道加载失败时应该节流重试而不是每次状态更新都重试", async () => {
    vi.useFakeTimers();

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getSubtitleTracks).mockRejectedValue(
      new Error("Failed to extract tracks"),
    );

    let triggerUpdate: (torrents: TorrentStatusInfo[]) => void;
    vi.mocked(mockTorrentRepository.subscribeTorrents).mockImplementation(
      (onUpdate) => {
        triggerUpdate = onUpdate;
        return Promise.resolve(() => {});
      },
    );

    const makeStatus = (progress: number) => ({
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: progress,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    });

    renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // 初次挂载会发起一次字幕轨道请求（失败）
    expect(mockTorrentRepository.getSubtitleTracks).toHaveBeenCalledTimes(1);

    // 第一次状态到达 → 触发一次重试
    await act(async () => {
      triggerUpdate([makeStatus(400)]);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(mockTorrentRepository.getSubtitleTracks).toHaveBeenCalledTimes(2);

    // 短时间内（未超过节流间隔）推进进度 → 不应重复重试
    await act(async () => {
      triggerUpdate([makeStatus(450)]);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(mockTorrentRepository.getSubtitleTracks).toHaveBeenCalledTimes(2);

    // 超过节流间隔（3s）且进度有推进 → 再次重试
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    await act(async () => {
      triggerUpdate([makeStatus(500)]);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(mockTorrentRepository.getSubtitleTracks).toHaveBeenCalledTimes(3);

    // 已到节流间隔但进度未推进 → 不重复重试
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    await act(async () => {
      triggerUpdate([makeStatus(500)]);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(mockTorrentRepository.getSubtitleTracks).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it("应该针对各种视频加载错误提示正确的错误信息", async () => {
    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue({
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    });

    renderPlayer("/play/hash123/0?fileName=test.mp4");

    await waitFor(() => {
      expect(screen.getByText("下载进度: 40.00%")).toBeInTheDocument();
    });

    const vjsMock = (globalThis as any).__vjsMock;

    // 1. Test error code 4 (格式不支持)
    await act(() => {
      vjsMock.setError({ code: 4 });
      vjsMock.trigger();
    });
    expect(toast.error).toHaveBeenCalledWith(
      "当前浏览器不支持播放该格式（例如 MKV 容器），建议点击上方按钮“用系统播放器播放”。",
      { duration: 8000 },
    );

    // 2. Test error code 3 (解码失败)
    await act(() => {
      vjsMock.setError({ code: 3 });
      vjsMock.trigger();
    });
    expect(toast.error).toHaveBeenCalledWith(
      "视频解码失败，可能数据已损坏或编码不支持。",
      { duration: 8000 },
    );

    // 3. Test error code 2 (网络断开)
    await act(() => {
      vjsMock.setError({ code: 2 });
      vjsMock.trigger();
    });
    expect(toast.error).toHaveBeenCalledWith("视频加载超时或网络断开。", {
      duration: 8000,
    });

    // 4. Test generic error (code 0 falls through to generic message)
    await act(() => {
      vjsMock.setError({ code: 0 });
      vjsMock.trigger();
    });
    expect(toast.error).toHaveBeenCalledWith("视频加载失败", {
      duration: 8000,
    });

    // 5. Test error code 1 (covers inner conditional else branch)
    await act(() => {
      vjsMock.setError({ code: 1 });
      vjsMock.trigger();
    });
    expect(toast.error).toHaveBeenCalledWith("视频加载失败", {
      duration: 8000,
    });
  });

  it("当订阅状态更新且找不到对应种子的状态时，应该保持 torrentStatus 为空", async () => {
    vi.useFakeTimers();

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );

    let triggerUpdate: any;
    vi.mocked(mockTorrentRepository.subscribeTorrents).mockImplementation(
      (onUpdate) => {
        triggerUpdate = onUpdate;
        return Promise.resolve(() => {});
      },
    );

    renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    await act(async () => {
      triggerUpdate([{ info_hash: "other_hash" }]);
    });

    expect(screen.getByText("下载进度: 计算中...")).toBeInTheDocument();
  });

  it("在播放器初始化抛出错误且组件已卸载时，不应该更新状态或展示 Toast", async () => {
    let rejectPromise: any;
    const promise = new Promise<string>((_, reject) => {
      rejectPromise = () => reject(new Error("Async Error"));
    });

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockReturnValue(
      promise,
    );

    const { unmount } = renderPlayer("/play/hash123/0");

    unmount();

    await act(async () => {
      rejectPromise();
      try {
        await promise;
      } catch {}
    });

    expect(toast.error).not.toHaveBeenCalledWith(
      expect.stringContaining("无法获取视频流"),
    );
  });

  it("应该支持从 React Router state 获取视频标题和封面，并处理未加载完成时的 unmount", async () => {
    vi.useFakeTimers();

    let resolveStatus: any;
    const statusPromise = new Promise<any>((resolve) => {
      resolveStatus = resolve;
    });

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockReturnValue(
      statusPromise,
    );

    const { unmount } = render(
      <DIProvider value={mockContainer}>
        <AppContextProvider>
          <MemoryRouter
            initialEntries={[
              {
                pathname: "/play/hash123/0",
                state: {
                  name: "State Title",
                  imageUrl: "http://example.com/cover.jpg",
                },
              },
            ]}
          >
            <LocationTracker />
            <Routes>
              <Route path="/" element={<NavBarLayout />}>
                <Route path="play/:infoHash/:fileId" element={<Player />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AppContextProvider>
      </DIProvider>,
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    unmount();

    await act(async () => {
      resolveStatus({
        info_hash: "hash123",
        name: "测试视频",
        progress_bytes: 400,
        total_bytes: 1000,
        finished: false,
        download_speed_bytes_per_sec: 100,
        paused: false,
        peers_connected: 0,
        peers_total: 0,
      });
    });

    vi.useRealTimers();
  });

  it("在订阅状态更新回调触发且组件已卸载时，不应该处理更新", async () => {
    vi.useFakeTimers();

    const mockStatus = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    };

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
      mockStatus,
    );

    let triggerUpdate: any;
    vi.mocked(mockTorrentRepository.subscribeTorrents).mockImplementation(
      (onUpdate) => {
        triggerUpdate = onUpdate;
        return Promise.resolve(() => {});
      },
    );

    const { unmount } = renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    unmount();

    await act(async () => {
      triggerUpdate([mockStatus]);
    });

    vi.useRealTimers();
  });

  it("应该支持从空的 React Router state 获取视频标题和封面", async () => {
    vi.useFakeTimers();
    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue({
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    });

    render(
      <DIProvider value={mockContainer}>
        <AppContextProvider>
          <MemoryRouter
            initialEntries={[
              {
                pathname: "/play/hash123/0",
                state: {}, // Empty state to cover state?.name and state?.imageUrl fallback
              },
            ]}
          >
            <LocationTracker />
            <Routes>
              <Route path="/" element={<NavBarLayout />}>
                <Route path="play/:infoHash/:fileId" element={<Player />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AppContextProvider>
      </DIProvider>,
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    vi.useRealTimers();
  });

  it("应该支持清理空的字幕 URL 对象", async () => {
    vi.useFakeTimers();

    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue("");

    const mockStatus = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    };

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
      mockStatus,
    );
    vi.mocked(mockTorrentRepository.getSubtitleTracks).mockResolvedValue([
      { id: 1, language: "eng", title: "English" } as any,
    ]);
    vi.mocked(mockTorrentRepository.getSubtitleVtt).mockResolvedValue("WEBVTT");

    const { unmount } = renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    unmount();

    URL.createObjectURL = originalCreateObjectURL;
    vi.useRealTimers();
  });

  it("在获取字幕轨道成功且组件已卸载时，应该不更新状态", async () => {
    vi.useFakeTimers();

    let resolveTracks: any;
    const tracksPromise = new Promise<any>((resolve) => {
      resolveTracks = resolve;
    });

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue({
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    });
    vi.mocked(mockTorrentRepository.getSubtitleTracks).mockReturnValue(
      tracksPromise,
    );

    const { unmount } = renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    unmount();

    await act(async () => {
      resolveTracks([{ id: 1, language: "eng", title: "English" }]);
    });

    vi.useRealTimers();
  });

  it("在获取字幕轨道失败且组件已卸载时，应该优雅忽略并不打印警告", async () => {
    vi.useFakeTimers();

    let rejectTracks: any;
    const tracksPromise = new Promise<any>((_, reject) => {
      rejectTracks = reject;
    });

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue({
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    });
    vi.mocked(mockTorrentRepository.getSubtitleTracks).mockReturnValue(
      tracksPromise,
    );

    const { unmount } = renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    unmount();

    await act(async () => {
      rejectTracks(new Error("Subtitle fetch failed"));
    });

    vi.useRealTimers();
  });

  it("切换字幕轨道时应该按需加载 VTT", async () => {
    vi.useFakeTimers();

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue({
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    });
    vi.mocked(mockTorrentRepository.getSubtitleTracks).mockResolvedValue([
      { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
      { id: 2, language: "chi", title: "Chinese", codec: "S_TEXT/UTF8" },
    ]);
    vi.mocked(mockTorrentRepository.getSubtitleVtt).mockResolvedValue(
      "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello World\n",
    );

    renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledTimes(1);
    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledWith(
      "hash123",
      0,
      1,
    );

    const trigger = screen.getByRole("combobox");
    await act(async () => {
      fireEvent.click(trigger);
    });

    const option = screen.getByRole("option", { name: /Chinese/i });
    await act(async () => {
      fireEvent.click(option);
    });

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledTimes(2);
    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledWith(
      "hash123",
      0,
      2,
    );

    vi.useRealTimers();
  });

  it("字幕仍在加载时自动刷新不应发起重复请求", async () => {
    vi.useFakeTimers();

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    const status400 = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    };
    const status600 = {
      ...status400,
      progress_bytes: 600,
    };
    vi.mocked(mockTorrentRepository.getSubtitleTracks).mockResolvedValue([
      { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
    ]);

    const vttResolvers: Array<(value: string) => void> = [];
    vi.mocked(mockTorrentRepository.getSubtitleVtt).mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          vttResolvers.push(resolve);
        }),
    );

    let triggerUpdate: (torrents: TorrentStatusInfo[]) => void;
    vi.mocked(mockTorrentRepository.subscribeTorrents).mockImplementation(
      (onUpdate) => {
        triggerUpdate = onUpdate;
        return Promise.resolve(() => {});
      },
    );

    renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // 自动加载轨道 1（第一次请求挂起中）
    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledTimes(1);

    // 第一次请求完成，记录 40% 基线
    await act(async () => {
      vttResolvers[0](
        "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello World\n",
      );
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    await act(async () => {
      triggerUpdate([status400]);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // 进度推进到 60% → 自动刷新，第二次请求挂起
    await act(async () => {
      triggerUpdate([status600]);
    });
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    }
    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledTimes(2);

    // 再次收到进度更新（仍挂起中）→ 不应发起第三次请求
    await act(async () => {
      triggerUpdate([{ ...status600, progress_bytes: 650 }]);
    });
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    }
    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledTimes(2);

    // 完成挂起的第二次请求，避免悬挂副作用
    await act(async () => {
      vttResolvers[1](
        "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello World\n",
      );
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    vi.useRealTimers();
  });

  it("关闭字幕时应不加载额外 VTT", async () => {
    vi.useFakeTimers();

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue({
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    });
    vi.mocked(mockTorrentRepository.getSubtitleTracks).mockResolvedValue([
      { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
      { id: 2, language: "chi", title: "Chinese", codec: "S_TEXT/UTF8" },
    ]);
    vi.mocked(mockTorrentRepository.getSubtitleVtt).mockResolvedValue(
      "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello World\n",
    );

    renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledTimes(1);

    const trigger = screen.getByRole("combobox");
    await act(async () => {
      fireEvent.click(trigger);
    });

    const option = screen.getByRole("option", { name: "关闭" });
    await act(async () => {
      fireEvent.click(option);
    });

    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("切回已加载的字幕轨道时应强制重新提取 VTT", async () => {
    vi.useFakeTimers();

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue({
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    });
    vi.mocked(mockTorrentRepository.getSubtitleTracks).mockResolvedValue([
      { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
      { id: 2, language: "chi", title: "Chinese", codec: "S_TEXT/UTF8" },
    ]);
    vi.mocked(mockTorrentRepository.getSubtitleVtt).mockResolvedValue(
      "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello World\n",
    );

    renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // 自动加载轨道 1
    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledTimes(1);
    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledWith(
      "hash123",
      0,
      1,
    );

    // 切换到轨道 2
    const trigger = screen.getByRole("combobox");
    await act(async () => {
      fireEvent.click(trigger);
    });
    const option2 = screen.getByRole("option", { name: /Chinese/i });
    await act(async () => {
      fireEvent.click(option2);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledTimes(2);

    // 等待下拉菜单关闭动画完成后再重新打开
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    // 切回轨道 1 应强制重新提取（绕过缓存）
    await act(async () => {
      fireEvent.click(trigger);
    });
    const option1 = screen.getByRole("option", { name: /English/i });
    await act(async () => {
      fireEvent.click(option1);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledTimes(3);
    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenLastCalledWith(
      "hash123",
      0,
      1,
    );

    vi.useRealTimers();
  });

  it("下载进度跨过阈值时应该自动重新提取当前轨道字幕", async () => {
    vi.useFakeTimers();

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    const status400 = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    };
    const status600 = {
      ...status400,
      progress_bytes: 600,
    };
    vi.mocked(mockTorrentRepository.getSubtitleTracks).mockResolvedValue([
      { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
    ]);
    vi.mocked(mockTorrentRepository.getSubtitleVtt).mockResolvedValue(
      "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello World\n",
    );

    let triggerUpdate: (torrents: TorrentStatusInfo[]) => void;
    vi.mocked(mockTorrentRepository.subscribeTorrents).mockImplementation(
      (onUpdate) => {
        triggerUpdate = onUpdate;
        return Promise.resolve(() => {});
      },
    );

    renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // 先推送 40% 状态，建立字幕加载基线（40%）
    await act(async () => {
      triggerUpdate([status400]);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledTimes(1);

    // 进度从 40% 推进到 60%（超过 10% 阈值）→ 自动重新提取轨道 1
    await act(async () => {
      triggerUpdate([status600]);
    });
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    }

    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledTimes(2);
    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenLastCalledWith(
      "hash123",
      0,
      1,
    );

    vi.useRealTimers();
  });

  it("下载完成后应该自动重新提取当前轨道字幕且不会反复刷新", async () => {
    vi.useFakeTimers();

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    const status400 = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    };
    const statusFinished = {
      ...status400,
      progress_bytes: 1000,
      finished: true,
      download_speed_bytes_per_sec: 0,
    };
    vi.mocked(mockTorrentRepository.getSubtitleTracks).mockResolvedValue([
      { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
    ]);
    vi.mocked(mockTorrentRepository.getSubtitleVtt).mockResolvedValue(
      "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello World\n",
    );

    let triggerUpdate: (torrents: TorrentStatusInfo[]) => void;
    vi.mocked(mockTorrentRepository.subscribeTorrents).mockImplementation(
      (onUpdate) => {
        triggerUpdate = onUpdate;
        return Promise.resolve(() => {});
      },
    );

    renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // 先推送 40% 状态，建立字幕加载基线（40%）
    await act(async () => {
      triggerUpdate([status400]);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledTimes(1);

    // 下载完成 → 自动重新提取完整 VTT
    await act(async () => {
      triggerUpdate([statusFinished]);
    });
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    }

    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledTimes(2);
    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenLastCalledWith(
      "hash123",
      0,
      1,
    );

    // 完成后的再次推送不应触发重复刷新
    await act(async () => {
      triggerUpdate([statusFinished]);
    });
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    }

    expect(mockTorrentRepository.getSubtitleVtt).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("重新提取字幕时应撤销旧的 object URL", async () => {
    vi.useFakeTimers();

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    let urlIndex = 0;
    URL.createObjectURL = vi.fn(() => `blob:mock-url-${++urlIndex}`);
    URL.revokeObjectURL = vi.fn();

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue({
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    });
    vi.mocked(mockTorrentRepository.getSubtitleTracks).mockResolvedValue([
      { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
      { id: 2, language: "chi", title: "Chinese", codec: "S_TEXT/UTF8" },
    ]);
    vi.mocked(mockTorrentRepository.getSubtitleVtt).mockResolvedValue(
      "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello World\n",
    );

    renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // 自动加载轨道 1 → 创建 blob:mock-url-1
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    // 切到轨道 2（创建 blob:mock-url-2），再切回轨道 1 → 撤销 blob:mock-url-1
    const trigger = screen.getByRole("combobox");
    await act(async () => {
      fireEvent.click(trigger);
    });
    const option2 = screen.getByRole("option", { name: /Chinese/i });
    await act(async () => {
      fireEvent.click(option2);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // 等待关闭动画完成，重新打开并切回轨道 1 → 撤销 blob:mock-url-1
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    await act(async () => {
      fireEvent.click(trigger);
    });
    const option1 = screen.getByRole("option", { name: /English/i });
    await act(async () => {
      fireEvent.click(option1);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url-1");

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.useRealTimers();
  });

  it("当获取到章节信息时，应该正确渲染章节列表并格式化时间", async () => {
    vi.useFakeTimers();
    const mockStatus = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
    };

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
      mockStatus,
    );
    vi.mocked(mockTorrentRepository.getVideoChapters).mockResolvedValue([
      { start_ms: 0, end_ms: 3661000, title: "开场", language: "chi" },
      { start_ms: 3661000, end_ms: null, title: "正片", language: "jpn" },
    ]);

    renderPlayer(
      "/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mkv",
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(mockTorrentRepository.getVideoChapters).toHaveBeenCalledWith(
      "hash123",
      0,
    );
    expect(screen.getByText("章节")).toBeInTheDocument();
    expect(screen.getByText("开场")).toBeInTheDocument();
    expect(screen.getByText("正片")).toBeInTheDocument();
    expect(screen.getByText("01:01:01")).toBeInTheDocument();
    expect(screen.queryByText("章节")).toBeInTheDocument();
  });

  it("当章节信息为空或加载中时，不应该渲染章节区块", async () => {
    vi.useFakeTimers();
    vi.mocked(mockTorrentRepository.getVideoChapters).mockResolvedValue([]);

    renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(screen.queryByText("章节")).not.toBeInTheDocument();
  });
});

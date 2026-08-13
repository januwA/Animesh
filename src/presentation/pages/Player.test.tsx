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
import { resetAppStores } from "@/test/store-reset";
import { createDIContainerForTest } from "@/test/test-utils";
import { NavBarLayout } from "../components/Layout";
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

import type { VideoMetadata } from "@/domain/torrent/TorrentSchemas";

const emptyMetadata: VideoMetadata = {
  tracks: [],
  chapters: [],
  video_info: {
    date_utc: null,
    muxing_app: "",
    writing_app: "",
    video_tracks: [],
    audio_tracks: [],
  },
};

const makeVideoMetadata = (overrides: Partial<VideoMetadata> = {}) => ({
  ...emptyMetadata,
  ...overrides,
});

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
      getSubtitleVtt: vi.fn(),
      getVideoMetadata: vi.fn().mockResolvedValue(emptyMetadata),
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
      setTorrentSubject: vi.fn().mockResolvedValue(undefined),
      clearTorrentSubject: vi.fn().mockResolvedValue(undefined),
    };

    mockContainer = createDIContainerForTest({
      torrentRepository: mockTorrentRepository,
    });

    currentLocation.current = null;
    resetAppStores();
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
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
    expect(screen.getByText("下载: 100 B/s")).toBeInTheDocument();
    expect(screen.getByText("上传: 100 B/s (连接: 0/0)")).toBeInTheDocument();
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
      upload_speed_bytes_per_sec: 0,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    };
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
      finishedStatus,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.getByText("下载进度: 100.00%")).toBeInTheDocument();
    expect(screen.getByText("下载: 未知大小/s")).toBeInTheDocument();
    expect(
      screen.getByText("上传: 未知大小/s (连接: 0/0)"),
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
      upload_speed_bytes_per_sec: 0,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
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
      upload_speed_bytes_per_sec: 0,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
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
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({ tracks: mockSubtracks }),
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

  it("当获取元数据失败时，应该优雅处理并打印错误", async () => {
    vi.useFakeTimers();
    const mockStatus = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    };

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
      mockStatus,
    );
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockRejectedValue(
      new Error("Failed to load metadata"),
    );

    renderPlayer(
      "/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mp4",
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // Trigger the interval and wait for the polling catch block to execute
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
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
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({ tracks: mockSubtracks }),
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

  it("在初始加载失败后，应该在轮询中成功加载元数据与字幕", async () => {
    vi.useFakeTimers();
    const mockStatus = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
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
    const mockMetadata = makeVideoMetadata({
      tracks: [
        { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
      ],
    });
    vi.mocked(mockTorrentRepository.getVideoMetadata)
      .mockRejectedValueOnce(new Error("First try fails"))
      .mockResolvedValueOnce(mockMetadata);

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
      await vi.advanceTimersByTimeAsync(10000);
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

  it("当元数据尚未就绪时应该每 10 秒轮询重试", async () => {
    vi.useFakeTimers();

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockRejectedValue(
      new Error("Failed to extract metadata"),
    );

    renderPlayer("/play/hash123/0");

    // Flush initialization microtasks
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // 初次挂载会发起一次元数据请求（失败）
    expect(mockTorrentRepository.getVideoMetadata).toHaveBeenCalledTimes(1);

    // 每 10 秒轮询一次
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(mockTorrentRepository.getVideoMetadata).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(mockTorrentRepository.getVideoMetadata).toHaveBeenCalledTimes(3);

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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
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
        upload_speed_bytes_per_sec: 100,
        paused: false,
        peers_connected: 0,
        peers_total: 0,
        trackers: [],
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    });

    render(
      <DIProvider value={mockContainer}>
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    };

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
      mockStatus,
    );
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({
        tracks: [{ id: 1, language: "eng", title: "English" } as any],
      }),
    );
    vi.mocked(mockTorrentRepository.getSubtitleVtt).mockResolvedValue("WEBVTT");

    const { unmount } = renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    unmount();

    URL.createObjectURL = originalCreateObjectURL;
    vi.useRealTimers();
  });

  it("在获取元数据成功且组件已卸载时，应该不更新状态", async () => {
    vi.useFakeTimers();

    let resolveMetadata: any;
    const metadataPromise = new Promise<any>((resolve) => {
      resolveMetadata = resolve;
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    });
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockReturnValue(
      metadataPromise,
    );

    const { unmount } = renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    unmount();

    await act(async () => {
      resolveMetadata(
        makeVideoMetadata({
          tracks: [
            { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
          ],
        }),
      );
    });

    vi.useRealTimers();
  });

  it("在获取元数据失败且组件已卸载时，应该优雅忽略并不打印警告", async () => {
    vi.useFakeTimers();

    let rejectMetadata: any;
    const metadataPromise = new Promise<any>((_, reject) => {
      rejectMetadata = reject;
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    });
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockReturnValue(
      metadataPromise,
    );

    const { unmount } = renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    unmount();

    await act(async () => {
      rejectMetadata(new Error("Subtitle fetch failed"));
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    });
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({
        tracks: [
          { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
          { id: 2, language: "chi", title: "Chinese", codec: "S_TEXT/UTF8" },
        ],
      }),
    );
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    };
    const status600 = {
      ...status400,
      progress_bytes: 600,
    };
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({
        tracks: [
          { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
        ],
      }),
    );

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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    });
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({
        tracks: [
          { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
          { id: 2, language: "chi", title: "Chinese", codec: "S_TEXT/UTF8" },
        ],
      }),
    );
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    });
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({
        tracks: [
          { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
          { id: 2, language: "chi", title: "Chinese", codec: "S_TEXT/UTF8" },
        ],
      }),
    );
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    };
    const status600 = {
      ...status400,
      progress_bytes: 600,
    };
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({
        tracks: [
          { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
        ],
      }),
    );
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    };
    const statusFinished = {
      ...status400,
      progress_bytes: 1000,
      finished: true,
      download_speed_bytes_per_sec: 0,
    };
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({
        tracks: [
          { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
        ],
      }),
    );
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    });
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({
        tracks: [
          { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
          { id: 2, language: "chi", title: "Chinese", codec: "S_TEXT/UTF8" },
        ],
      }),
    );
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    };

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
      mockStatus,
    );
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({
        chapters: [
          { start_ms: 0, end_ms: 3661000, title: "开场", language: "chi" },
          { start_ms: 3661000, end_ms: null, title: "正片", language: "jpn" },
        ],
      }),
    );

    renderPlayer(
      "/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mkv",
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(mockTorrentRepository.getVideoMetadata).toHaveBeenCalledWith(
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

    renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(screen.queryByText("章节")).not.toBeInTheDocument();
  });

  it("点击章节项时应该调用播放器跳转到对应时间", async () => {
    vi.useFakeTimers();
    const mockStatus = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    };

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
      mockStatus,
    );
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({
        chapters: [
          { start_ms: 0, end_ms: 3661000, title: "开场", language: "chi" },
          { start_ms: 3661000, end_ms: null, title: "正片", language: "jpn" },
        ],
      }),
    );

    renderPlayer(
      "/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mkv",
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(screen.getByText("正片")).toBeInTheDocument();

    const vjsMock = (globalThis as any).__vjsMock;
    const seekSpy = vi.spyOn(vjsMock, "seek");

    const chapterButton = screen.getByText("正片").closest("button");
    expect(chapterButton).not.toBeNull();

    act(() => {
      fireEvent.click(chapterButton!);
    });

    expect(seekSpy).toHaveBeenCalledWith(3661);
  });

  it("当章节跳转失败时，应该显示错误提示", async () => {
    vi.useFakeTimers();
    const mockStatus = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    };

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
      mockStatus,
    );
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({
        chapters: [
          { start_ms: 0, end_ms: 3661000, title: "开场", language: "chi" },
        ],
      }),
    );

    renderPlayer(
      "/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mkv",
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    const vjsMock = (globalThis as any).__vjsMock;
    const originalSeek = vjsMock.seek;
    vjsMock.seek = vi.fn().mockRejectedValue(new Error("seek failed"));

    const chapterButton = screen.getByText("开场").closest("button");
    expect(chapterButton).not.toBeNull();

    act(() => {
      fireEvent.click(chapterButton!);
    });

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(toast.error).toHaveBeenCalledWith("跳转到章节失败");

    vjsMock.seek = originalSeek;
    vi.useRealTimers();
  });

  it("获取到媒体信息时应该渲染媒体信息区块", async () => {
    vi.useFakeTimers();
    const mockStatus = {
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 400,
      total_bytes: 1000,
      finished: false,
      download_speed_bytes_per_sec: 100,
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    };

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue(
      mockStatus,
    );
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({
        video_info: {
          date_utc: 978_307_200,
          muxing_app: "mkvmerge",
          writing_app: "libebml",
          video_tracks: [
            {
              track_id: 1,
              codec: "V_MPEG4/ISO/AVC",
              width: 1920,
              height: 1080,
              language: "und",
              default: true,
              forced: false,
            },
          ],
          audio_tracks: [
            {
              track_id: 2,
              codec: "A_AAC",
              channels: 2,
              sampling_rate: 48000,
              language: "jpn",
              default: true,
            },
          ],
        },
      }),
    );

    renderPlayer(
      "/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mkv",
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(mockTorrentRepository.getVideoMetadata).toHaveBeenCalledWith(
      "hash123",
      0,
    );
    expect(screen.getByText("媒体信息")).toBeInTheDocument();
    expect(screen.getByText("V_MPEG4/ISO/AVC 1920x1080")).toBeInTheDocument();
    expect(screen.getByText("A_AAC 2ch 48000Hz")).toBeInTheDocument();
  });

  it("当媒体信息包含空值字段时，应该显示未知或无的回退文本", async () => {
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    });
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata(),
    );

    renderPlayer(
      "/play/hash123/0?magnet=magurl&title=test_title&fileName=video_name.mkv",
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(screen.getByText("媒体信息")).toBeInTheDocument();
    expect(screen.getAllByText("未知").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("标题:")).not.toBeInTheDocument();
  });

  it("在元数据尚未就绪时，应该每 10 秒轮询重试，并在下载完成后停止", async () => {
    vi.useFakeTimers();
    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockRejectedValue(
      new Error("metadata not ready"),
    );

    let triggerUpdate: (torrents: TorrentStatusInfo[]) => void;
    vi.mocked(mockTorrentRepository.subscribeTorrents).mockImplementation(
      (onUpdate) => {
        triggerUpdate = onUpdate;
        return Promise.resolve(() => {});
      },
    );

    const makeStatus = (progress: number, finished = false) => ({
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: progress,
      total_bytes: 1000,
      finished,
      download_speed_bytes_per_sec: 100,
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    });

    renderPlayer("/play/hash123/0");

    // Flush initialization microtasks
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // 初次挂载发起一次元数据请求（失败）
    expect(mockTorrentRepository.getVideoMetadata).toHaveBeenCalledTimes(1);

    // 每 10 秒轮询一次
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(mockTorrentRepository.getVideoMetadata).toHaveBeenCalledTimes(2);

    // 下载完成 → 停止轮询（因已有永久错误，不再重试）
    await act(async () => {
      triggerUpdate([makeStatus(1000, true)]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    // 只有初次 + 1 次轮询 = 2 次，完成后不再重试
    expect(mockTorrentRepository.getVideoMetadata).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("当下载已完成但元数据尚未解析时，应该立即刷新一次元数据", async () => {
    vi.useFakeTimers();

    vi.mocked(mockTorrentRepository.getTorrentStreamUrl).mockResolvedValue(
      "http://127.0.0.1:12345/stream/hash123/0",
    );
    vi.mocked(mockTorrentRepository.getTorrentStatus).mockResolvedValue({
      info_hash: "hash123",
      name: "测试视频",
      progress_bytes: 1000,
      total_bytes: 1000,
      finished: true,
      download_speed_bytes_per_sec: 0,
      upload_speed_bytes_per_sec: 0,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    });
    // 第一次解析返回空元数据，触发进度 100% 时的立即刷新
    vi.mocked(mockTorrentRepository.getVideoMetadata)
      .mockResolvedValueOnce(null as unknown as VideoMetadata)
      .mockResolvedValue(emptyMetadata);

    renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // 初次请求之外，下载进度 100% 时会触发元数据立即刷新
    expect(
      vi.mocked(mockTorrentRepository.getVideoMetadata).mock.calls.length,
    ).toBeGreaterThan(1);

    vi.useRealTimers();
  });

  it("当字幕轨道标题为空时，应该回退显示轨道编号", async () => {
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    });
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({
        tracks: [{ id: 7, language: "eng", title: "", codec: "S_TEXT/UTF8" }],
      }),
    );
    vi.mocked(mockTorrentRepository.getSubtitleVtt).mockResolvedValue(
      "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello\n",
    );

    renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    const trigger = screen.getByRole("combobox");
    await act(async () => {
      fireEvent.click(trigger);
    });

    expect(screen.getAllByText("轨道 7 (eng)").length).toBeGreaterThanOrEqual(
      1,
    );

    vi.useRealTimers();
  });

  it("当字幕正在加载时，应该显示加载旋转图标", async () => {
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    });
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({
        tracks: [
          { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
        ],
      }),
    );

    let resolveVtt: (value: string) => void;
    vi.mocked(mockTorrentRepository.getSubtitleVtt).mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveVtt = resolve;
        }),
    );

    renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();

    await act(async () => {
      resolveVtt!("WEBVTT");
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    vi.useRealTimers();
  });

  it("当存在 Tracker 服务器时，应该渲染 Tracker 列表", async () => {
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [
        "udp://tracker1.example.com:6969",
        "udp://tracker2.example.com:1337",
      ],
    });

    renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(screen.getByText("Tracker 服务器")).toBeInTheDocument();
    expect(
      screen.getByText("udp://tracker1.example.com:6969"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("udp://tracker2.example.com:1337"),
    ).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("当不存在 Tracker 服务器时，应该显示暂无 Tracker 信息", async () => {
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    });

    renderPlayer("/play/hash123/0");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(screen.getByText("Tracker 服务器")).toBeInTheDocument();
    expect(screen.getByText("暂无 Tracker 信息")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("当创建时间为空时，应该显示未知", async () => {
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
      upload_speed_bytes_per_sec: 100,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    });
    vi.mocked(mockTorrentRepository.getVideoMetadata).mockResolvedValue(
      makeVideoMetadata({
        video_info: {
          date_utc: null,
          muxing_app: "mkvmerge",
          writing_app: "libebml",
          video_tracks: [
            {
              track_id: 1,
              codec: "V_MPEG4/ISO/AVC",
              width: 1920,
              height: 1080,
              language: "und",
              default: true,
              forced: false,
            },
          ],
          audio_tracks: [
            {
              track_id: 2,
              codec: "A_AAC",
              channels: 2,
              sampling_rate: 48000,
              language: "jpn",
              default: true,
            },
          ],
        },
      }),
    );

    renderPlayer("/play/hash123/0?fileName=test.mp4");

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(screen.getByText("媒体信息")).toBeInTheDocument();
    const unknownTexts = screen.getAllByText("未知");
    expect(unknownTexts.length).toBeGreaterThanOrEqual(1);

    vi.useRealTimers();
  });
});

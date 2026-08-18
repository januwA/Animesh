import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SubtitleTranslationRepository } from "@/domain/subtitle/SubtitleTranslationRepository";
import type { TorrentRepository } from "@/domain/torrent/TorrentRepository";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { createDIContainerForTest } from "@/test/test-utils";
import type { SubtitleTrackItem } from "./usePlayerSubtitle";
import { usePlayerSubtitle } from "./usePlayerSubtitle";

const infoHash = NonEmptyStringSchema.parse("hash123");

const makeStatus = (progress: number, finished = false): TorrentStatusInfo => ({
  info_hash: infoHash,
  name: NonEmptyStringSchema.parse("测试视频"),
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

const makeSubtitleTranslationRepo = (
  overrides: Partial<SubtitleTranslationRepository>,
): SubtitleTranslationRepository => ({
  getById: vi.fn().mockResolvedValue(null),
  listByTorrent: vi.fn().mockResolvedValue([]),
  save: vi.fn().mockResolvedValue(undefined),
  deleteById: vi.fn().mockResolvedValue(true),
  deleteByTorrent: vi.fn().mockResolvedValue(1),
  deleteByInfoHash: vi.fn().mockResolvedValue(1),
  ...overrides,
});

const tracks: SubtitleTrackItem[] = [
  { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
  { id: 2, language: "chi", title: "Chinese", codec: "S_TEXT/UTF8" },
];

describe("usePlayerSubtitle 字幕加载 hook", () => {
  let mockTorrentRepository: TorrentRepository;
  let container: DIContainer;

  beforeEach(() => {
    URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    URL.revokeObjectURL = vi.fn();
    mockTorrentRepository = {
      getSubtitleVtt: vi.fn().mockResolvedValue("WEBVTT\n\nHello"),
    } as unknown as TorrentRepository;
    container = createDIContainerForTest({
      torrentRepository: mockTorrentRepository,
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <DIProvider value={container}>{children}</DIProvider>
  );

  const baseParams = {
    infoHash,
    fileId: 0,
    originalSubtitleTracks: tracks,
    torrentStatus: makeStatus(400),
    downloadProgress: 40,
  };

  it("应该自动选择第一个字幕轨道并加载其 VTT", async () => {
    const { result } = renderHook(() => usePlayerSubtitle(baseParams), {
      wrapper,
    });

    await waitFor(() => {
      expect(
        vi.mocked(mockTorrentRepository.getSubtitleVtt),
      ).toHaveBeenCalledWith("hash123", 0, 1);
    });
    await waitFor(() => {
      expect(result.current.subtitleSources[1]?.url).toBe("blob:mock-url");
      expect(result.current.selectedTrackId).toBe(1);
    });
  });

  it("切换字幕轨道时应该按需加载新轨道的 VTT", async () => {
    const { result } = renderHook(() => usePlayerSubtitle(baseParams), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.selectedTrackId).toBe(1);
    });

    act(() => {
      result.current.handleSubtitleChange("2");
    });

    await waitFor(() => {
      expect(
        vi.mocked(mockTorrentRepository.getSubtitleVtt),
      ).toHaveBeenCalledWith("hash123", 0, 2);
      expect(result.current.selectedTrackId).toBe(2);
    });
  });

  it("关闭字幕时应该重新选中第一个轨道且不发起额外加载", async () => {
    const { result } = renderHook(() => usePlayerSubtitle(baseParams), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.selectedTrackId).toBe(1);
    });
    expect(
      vi.mocked(mockTorrentRepository.getSubtitleVtt),
    ).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleSubtitleChange("");
    });

    // 关闭后自动选择效果会重新选中首个轨道，但不会重复加载已缓存的 VTT
    expect(result.current.selectedTrackId).toBe(1);
    expect(
      vi.mocked(mockTorrentRepository.getSubtitleVtt),
    ).toHaveBeenCalledTimes(1);
  });

  it("切换到 AI 字幕轨道（UUID）时应该保持字符串轨道 id", async () => {
    const uuid = "b455b5f2-51c3-4d6b-80df-56540306bf79";
    const subtitleTranslationRepo = makeSubtitleTranslationRepo({
      getById: vi.fn().mockResolvedValue({
        id: uuid,
        vtt_content: "WEBVTT\n\nAI 字幕",
      }),
    });
    container = createDIContainerForTest({
      torrentRepository: mockTorrentRepository,
      subtitleTranslationRepository: subtitleTranslationRepo,
    });

    const { result } = renderHook(() => usePlayerSubtitle(baseParams), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.selectedTrackId).toBe(1);
    });

    act(() => {
      result.current.handleSubtitleChange(uuid);
    });

    await waitFor(() => {
      expect(subtitleTranslationRepo.getById).toHaveBeenCalledWith(uuid);
      expect(result.current.selectedTrackId).toBe(uuid);
      expect(result.current.subtitleSources[uuid]?.url).toBe("blob:mock-url");
    });
  });

  it("加载字幕失败时应该提示错误", async () => {
    container = createDIContainerForTest({
      torrentRepository: {
        getSubtitleVtt: vi.fn().mockRejectedValue(new Error("VTT load error")),
      },
    });

    renderHook(() => usePlayerSubtitle(baseParams), { wrapper });

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.stringContaining("加载字幕失败"),
      );
    });
  });

  it("下载进度跨过阈值时应该自动重新提取当前字幕轨道", async () => {
    const { result, rerender } = renderHook(
      ({ downloadProgress }) =>
        usePlayerSubtitle({ ...baseParams, downloadProgress }),
      { initialProps: { downloadProgress: 40 }, wrapper },
    );

    await waitFor(() => {
      expect(result.current.subtitleSources[1]?.loadedAtFraction).toBe(0.4);
    });
    expect(
      vi.mocked(mockTorrentRepository.getSubtitleVtt),
    ).toHaveBeenCalledTimes(1);

    rerender({ downloadProgress: 60 });
    await waitFor(() => {
      expect(
        vi.mocked(mockTorrentRepository.getSubtitleVtt),
      ).toHaveBeenCalledTimes(2);
    });
  });

  it("下载完成时应该自动重新提取一次且不反复刷新", async () => {
    const { result, rerender } = renderHook(
      ({ torrentStatus }) =>
        usePlayerSubtitle({ ...baseParams, torrentStatus }),
      { initialProps: { torrentStatus: makeStatus(400) }, wrapper },
    );

    await waitFor(() => {
      expect(result.current.subtitleSources[1]?.loadedAtFraction).toBe(0.4);
    });
    expect(
      vi.mocked(mockTorrentRepository.getSubtitleVtt),
    ).toHaveBeenCalledTimes(1);

    rerender({ torrentStatus: makeStatus(1000, true) });
    await waitFor(() => {
      expect(
        vi.mocked(mockTorrentRepository.getSubtitleVtt),
      ).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(result.current.subtitleSources[1]?.loadedWhenFinished).toBe(true);
    });

    rerender({ torrentStatus: makeStatus(1000, true) });
    await vi.waitFor(() => {
      expect(
        vi.mocked(mockTorrentRepository.getSubtitleVtt),
      ).toHaveBeenCalledTimes(2);
    });
  });

  it("当字幕加载进度未知时，下载进度更新应该直接更新加载进度且不重复请求", async () => {
    const { result, rerender } = renderHook(
      ({ torrentStatus, downloadProgress }) =>
        usePlayerSubtitle({ ...baseParams, torrentStatus, downloadProgress }),
      {
        initialProps: { torrentStatus: null, downloadProgress: 40 },
        wrapper,
      },
    );

    // torrentStatus 为 null 时 VTT 加载成功 → loadedAtFraction 为 null
    await waitFor(() => {
      expect(result.current.selectedTrackId).toBe(1);
      expect(result.current.subtitleSources[1]?.loadedAtFraction).toBeNull();
    });

    rerender({ torrentStatus: null, downloadProgress: 60 });
    await waitFor(() => {
      expect(result.current.subtitleSources[1]?.loadedAtFraction).toBe(0.6);
    });

    // patch 路径只更新进度，不会发起重新提取
    expect(
      vi.mocked(mockTorrentRepository.getSubtitleVtt),
    ).toHaveBeenCalledTimes(1);
  });

  it("字幕请求挂起时重复选择同一轨道应该被忽略", async () => {
    let resolveVtt!: (value: string) => void;
    const deferredRepo = {
      getSubtitleVtt: vi.fn().mockReturnValue(
        new Promise<string>((resolve) => {
          resolveVtt = resolve;
        }),
      ),
    } as unknown as TorrentRepository;
    container = createDIContainerForTest({
      torrentRepository: deferredRepo,
    });

    const { result } = renderHook(() => usePlayerSubtitle(baseParams), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.selectedTrackId).toBe(1);
    });
    expect(deferredRepo.getSubtitleVtt).toHaveBeenCalledTimes(1);

    // 首个请求仍挂起时再次选择同一轨道，不应发起重复请求
    act(() => {
      result.current.handleSubtitleChange("1");
    });
    expect(deferredRepo.getSubtitleVtt).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveVtt("WEBVTT\n\nHello");
    });
  });

  it("卸载时应该撤销所有字幕 object URL", async () => {
    const { result, unmount } = renderHook(
      () => usePlayerSubtitle(baseParams),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.subtitleSources[1]?.url).toBe("blob:mock-url");
    });

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});

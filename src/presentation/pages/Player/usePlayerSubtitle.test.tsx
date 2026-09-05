import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import type {
  SubtitleTrackItem,
  UsePlayerSubtitleDeps,
} from "./usePlayerSubtitle";
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
});

const tracks: SubtitleTrackItem[] = [
  { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
  { id: 2, language: "chi", title: "Chinese", codec: "S_TEXT/UTF8" },
];

const makeDeps = (
  overrides: Partial<UsePlayerSubtitleDeps> = {},
): UsePlayerSubtitleDeps => ({
  getSubtitleVttUseCase: {
    execute: vi.fn().mockResolvedValue("WEBVTT\n\nHello"),
  },
  ...overrides,
});

describe("usePlayerSubtitle 字幕加载 hook", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    URL.revokeObjectURL = vi.fn();
  });

  const baseParams = {
    infoHash,
    fileId: 0,
    originalSubtitleTracks: tracks,
    torrentStatus: makeStatus(400),
    downloadProgress: 40,
  };

  it("应该自动选择第一个字幕轨道并加载其 VTT", async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => usePlayerSubtitle(baseParams, deps));

    await waitFor(() => {
      expect(deps.getSubtitleVttUseCase.execute).toHaveBeenCalledWith({
        infoHash,
        fileId: 0,
        trackId: 1,
      });
    });
    await waitFor(() => {
      expect(result.current.subtitleSources[1]?.url).toBe("blob:mock-url");
      expect(result.current.selectedTrackId).toBe(1);
    });
  });

  it("切换字幕轨道时应该按需加载新轨道的 VTT", async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => usePlayerSubtitle(baseParams, deps));

    await waitFor(() => {
      expect(result.current.selectedTrackId).toBe(1);
    });

    act(() => {
      result.current.handleSubtitleChange("2");
    });

    await waitFor(() => {
      expect(deps.getSubtitleVttUseCase.execute).toHaveBeenCalledWith({
        infoHash,
        fileId: 0,
        trackId: 2,
      });
      expect(result.current.selectedTrackId).toBe(2);
    });
  });

  it("关闭字幕时应该重新选中第一个轨道且不发起额外加载", async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => usePlayerSubtitle(baseParams, deps));

    await waitFor(() => {
      expect(result.current.selectedTrackId).toBe(1);
    });
    expect(deps.getSubtitleVttUseCase.execute).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleSubtitleChange("");
    });

    // 关闭后自动选择效果会重新选中首个轨道，但不会重复加载已缓存的 VTT
    expect(result.current.selectedTrackId).toBe(1);
    expect(deps.getSubtitleVttUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it("切换到 AI 字幕轨道（UUID）时应该保持字符串轨道 id", async () => {
    const uuid = "b455b5f2-51c3-4d6b-80df-56540306bf79";
    const deps = makeDeps({
      getSubtitleVttUseCase: {
        execute: vi.fn().mockResolvedValue("WEBVTT\n\nAI 字幕"),
      },
    });

    const { result } = renderHook(() => usePlayerSubtitle(baseParams, deps));

    await waitFor(() => {
      expect(result.current.selectedTrackId).toBe(1);
    });

    act(() => {
      result.current.handleSubtitleChange(uuid);
    });

    await waitFor(() => {
      expect(deps.getSubtitleVttUseCase.execute).toHaveBeenCalledWith({
        infoHash,
        fileId: 0,
        trackId: uuid,
      });
      expect(result.current.selectedTrackId).toBe(uuid);
      expect(result.current.subtitleSources[uuid]?.url).toBe("blob:mock-url");
    });
  });

  it("加载字幕失败时应该提示错误", async () => {
    const deps = makeDeps({
      getSubtitleVttUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("VTT load error")),
      },
    });

    renderHook(() => usePlayerSubtitle(baseParams, deps));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.stringContaining("加载字幕失败"),
      );
    });
  });

  it("下载进度跨过阈值时应该自动重新提取当前字幕轨道", async () => {
    const deps = makeDeps();
    const { result, rerender } = renderHook(
      ({ downloadProgress }) =>
        usePlayerSubtitle({ ...baseParams, downloadProgress }, deps),
      { initialProps: { downloadProgress: 40 } },
    );

    await waitFor(() => {
      expect(result.current.subtitleSources[1]?.loadedAtFraction).toBe(0.4);
    });
    expect(deps.getSubtitleVttUseCase.execute).toHaveBeenCalledTimes(1);

    rerender({ downloadProgress: 60 });
    await waitFor(() => {
      expect(deps.getSubtitleVttUseCase.execute).toHaveBeenCalledTimes(2);
    });
  });

  it("下载完成时应该自动重新提取一次且不反复刷新", async () => {
    const deps = makeDeps();
    const { result, rerender } = renderHook(
      ({ torrentStatus }) =>
        usePlayerSubtitle({ ...baseParams, torrentStatus }, deps),
      { initialProps: { torrentStatus: makeStatus(400) } },
    );

    await waitFor(() => {
      expect(result.current.subtitleSources[1]?.loadedAtFraction).toBe(0.4);
    });
    expect(deps.getSubtitleVttUseCase.execute).toHaveBeenCalledTimes(1);

    rerender({ torrentStatus: makeStatus(1000, true) });
    await waitFor(() => {
      expect(deps.getSubtitleVttUseCase.execute).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(result.current.subtitleSources[1]?.loadedWhenFinished).toBe(true);
    });

    rerender({ torrentStatus: makeStatus(1000, true) });
    await vi.waitFor(() => {
      expect(deps.getSubtitleVttUseCase.execute).toHaveBeenCalledTimes(2);
    });
  });

  it("当字幕加载进度未知时，下载进度更新应该直接更新加载进度且不重复请求", async () => {
    const deps = makeDeps();
    const { result, rerender } = renderHook(
      ({ torrentStatus, downloadProgress }) =>
        usePlayerSubtitle(
          { ...baseParams, torrentStatus, downloadProgress },
          deps,
        ),
      { initialProps: { torrentStatus: null, downloadProgress: 40 } },
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
    expect(deps.getSubtitleVttUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it("字幕请求挂起时重复选择同一轨道应该被忽略", async () => {
    let resolveVtt!: (value: string) => void;
    const getSubtitleVtt = vi.fn().mockReturnValue(
      new Promise<string>((resolve) => {
        resolveVtt = resolve;
      }),
    );
    const deps = makeDeps({
      getSubtitleVttUseCase: { execute: getSubtitleVtt },
    });

    const { result } = renderHook(() => usePlayerSubtitle(baseParams, deps));

    await waitFor(() => {
      expect(result.current.selectedTrackId).toBe(1);
    });
    expect(getSubtitleVtt).toHaveBeenCalledTimes(1);

    // 首个请求仍挂起时再次选择同一轨道，不应发起重复请求
    act(() => {
      result.current.handleSubtitleChange("1");
    });
    expect(getSubtitleVtt).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveVtt("WEBVTT\n\nHello");
    });
  });

  it("卸载时应该撤销所有字幕 object URL", async () => {
    const deps = makeDeps();
    const { result, unmount } = renderHook(() =>
      usePlayerSubtitle(baseParams, deps),
    );

    await waitFor(() => {
      expect(result.current.subtitleSources[1]?.url).toBe("blob:mock-url");
    });

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});

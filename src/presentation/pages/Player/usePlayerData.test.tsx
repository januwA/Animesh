import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type {
  TorrentStatusInfo,
  VideoMetadata,
} from "@/domain/torrent/TorrentSchemas";
import type { UsePlayerDataDeps } from "./usePlayerData";
import { usePlayerData } from "./usePlayerData";

const infoHash = NonEmptyStringSchema.parse("hash123");

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

const mockAiRecord = {
  id: "b455b5f2-51c3-4d6b-80df-56540306bf79",
  info_hash: "hash123",
  file_id: 0,
  original_track_id: 1,
  source_lang: "eng",
  target_lang: "zh",
  vtt_content: "WEBVTT\n...",
  created_at: 1000,
  last_accessed_at: 1000,
};

const makeDeps = (
  overrides: Partial<UsePlayerDataDeps> = {},
): UsePlayerDataDeps => ({
  getTorrentStreamUrlUseCase: {
    execute: vi.fn().mockResolvedValue("http://127.0.0.1/stream/0"),
  },
  getVideoMetadataUseCase: {
    execute: vi.fn().mockResolvedValue(emptyMetadata),
  },
  getSubtitleTranslationsUseCase: {
    execute: vi.fn().mockResolvedValue([]),
  },
  ...overrides,
});

describe("usePlayerData 播放器数据 hook", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const baseParams = {
    infoHash,
    fileId: 0,
    torrentStatus: makeStatus(400),
    downloadProgress: 40,
  };

  it("应该查询流地址与元数据，并合成 AI 字幕轨道", async () => {
    const metadata: VideoMetadata = {
      ...emptyMetadata,
      tracks: [
        { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
      ],
    };
    const deps = makeDeps({
      getVideoMetadataUseCase: {
        execute: vi.fn().mockResolvedValue(metadata),
      },
      getSubtitleTranslationsUseCase: {
        execute: vi.fn().mockResolvedValue([mockAiRecord]),
      },
    });

    const { result } = renderHook(() => usePlayerData(baseParams, deps));

    await waitFor(() => {
      expect(result.current.streamUrl).toBe("http://127.0.0.1/stream/0");
      expect(result.current.metadata).toEqual(metadata);
      expect(result.current.originalSubtitleTracks).toHaveLength(1);
      expect(result.current.subtitleTracks).toHaveLength(2);
      expect(result.current.subtitleTracks[1]).toMatchObject({
        id: mockAiRecord.id,
        language: "zh",
        title: "AI · English",
        codec: "ai-translated-vtt",
        isAi: true,
      });
    });
  });

  it("AI 字幕轨道找不到原始轨道时应该回退为轨道编号", async () => {
    const aiRecord = {
      ...mockAiRecord,
      id: "c455b5f2-51c3-4d6b-80df-56540306bf78",
      original_track_id: 99,
      target_lang: "ja",
    };
    const deps = makeDeps({
      getSubtitleTranslationsUseCase: {
        execute: vi.fn().mockResolvedValue([aiRecord]),
      },
    });

    const { result } = renderHook(() => usePlayerData(baseParams, deps));

    await waitFor(() => {
      expect(result.current.subtitleTracks[0]).toMatchObject({
        title: "AI · 轨道 99",
        language: "ja",
      });
    });
  });

  it("元数据就绪后才会查询 AI 字幕翻译记录", async () => {
    const getSubtitleTranslations = vi.fn().mockResolvedValue([]);
    const deps = makeDeps({
      getSubtitleTranslationsUseCase: {
        execute: getSubtitleTranslations,
      },
    });

    renderHook(() => usePlayerData(baseParams, deps));

    await waitFor(() => {
      expect(getSubtitleTranslations).toHaveBeenCalledWith("hash123", 0);
    });
  });

  it("获取流地址失败时应该提示错误", async () => {
    const deps = makeDeps({
      getTorrentStreamUrlUseCase: {
        execute: vi
          .fn()
          .mockRejectedValue("Stream server port not initialized"),
      },
    });

    renderHook(() => usePlayerData(baseParams, deps));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.stringContaining("无法获取视频流"),
        { duration: 10000 },
      );
    });
  });

  it("元数据未就绪时应该每 10 秒轮询重试", async () => {
    vi.useFakeTimers();
    const getVideoMetadata = vi
      .fn()
      .mockRejectedValue(new Error("Failed to extract metadata"));
    const deps = makeDeps({
      getVideoMetadataUseCase: { execute: getVideoMetadata },
    });

    renderHook(() => usePlayerData(baseParams, deps));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getVideoMetadata).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(getVideoMetadata).toHaveBeenCalledTimes(2);
  });

  it("下载完成但元数据未解析时应该立即刷新一次", async () => {
    const getVideoMetadata = vi
      .fn()
      .mockResolvedValueOnce(null as unknown as VideoMetadata)
      .mockResolvedValue(emptyMetadata);
    const deps = makeDeps({
      getVideoMetadataUseCase: { execute: getVideoMetadata },
    });

    const { result } = renderHook(() =>
      usePlayerData(
        {
          ...baseParams,
          torrentStatus: makeStatus(1000, true),
          downloadProgress: 100,
        },
        deps,
      ),
    );

    await waitFor(() => {
      expect(result.current.metadata).toEqual(emptyMetadata);
    });
    expect(getVideoMetadata.mock.calls.length).toBeGreaterThan(1);
  });
});

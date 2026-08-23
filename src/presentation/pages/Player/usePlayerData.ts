import { useEffect, useMemo } from "react";
import type { GetSubtitleTranslationsUseCase } from "@/application/subtitle/GetSubtitleTranslationsUseCase";
import type { GetVideoMetadataUseCase } from "@/application/torrent/GetVideoMetadataUseCase";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type {
  TorrentStatusInfo,
  VideoInfo,
  VideoMetadata,
} from "@/domain/torrent/TorrentSchemas";
import { useQuery } from "@/presentation/hooks/useQuery";
import type { SubtitleTrackItem } from "./usePlayerSubtitle";

interface UsePlayerDataParams {
  infoHash: NonEmptyString;
  fileId: number;
  streamPort: number | null;
  torrentStatus: TorrentStatusInfo | null;
  downloadProgress: number;
}

/** usePlayerData 的依赖，由调用方（页面组合根）注入 */
export interface UsePlayerDataDeps {
  getVideoMetadataUseCase: Pick<GetVideoMetadataUseCase, "execute">;
  getSubtitleTranslationsUseCase: Pick<
    GetSubtitleTranslationsUseCase,
    "execute"
  >;
}

export interface PlayerDataResult {
  streamUrl: string | null;
  metadata: VideoMetadata | null;
  originalSubtitleTracks: SubtitleTrackItem[];
  subtitleTracks: SubtitleTrackItem[];
  chapters: VideoMetadata["chapters"];
  videoInfo: VideoInfo | null;
}

export function usePlayerData(
  params: UsePlayerDataParams,
  deps: UsePlayerDataDeps,
): PlayerDataResult {
  const { getVideoMetadataUseCase, getSubtitleTranslationsUseCase } = deps;
  const { infoHash, fileId, streamPort, torrentStatus, downloadProgress } =
    params;

  const streamUrl = useMemo<string | null>(() => {
    // v8 ignore next
    if (streamPort === null) return null;
    return `http://127.0.0.1:${streamPort}/stream/${infoHash}/${fileId}`;
  }, [streamPort, infoHash, fileId]);

  // Video metadata (subtitle tracks + chapters + video info), single query.
  const metadataQuery = useQuery<VideoMetadata>(
    (_ctx) => getVideoMetadataUseCase.execute(infoHash, fileId),
    [infoHash, fileId, getVideoMetadataUseCase],
  );
  const metadata = metadataQuery.data;

  // 每 10 秒轮询一次元数据，直到解析成功或下载已完成或遇到不支持的格式
  const isUnsupported =
    metadataQuery.error?.message.includes("Unsupported video format") ?? false;
  useEffect(() => {
    if (metadata || torrentStatus?.finished || isUnsupported) return;
    const timer = setInterval(() => metadataQuery.refetch(), 10_000);
    return () => clearInterval(timer);
  }, [metadata, torrentStatus?.finished, isUnsupported, metadataQuery.refetch]);

  // 下载进度达到 100% 且尚未有元数据且无永久错误时，立即刷新一次
  useEffect(() => {
    if (
      downloadProgress >= 100 &&
      !metadata &&
      !metadataQuery.error &&
      !metadataQuery.loading
    ) {
      metadataQuery.refetch();
    }
  }, [
    downloadProgress,
    metadata,
    metadataQuery.error,
    metadataQuery.loading,
    metadataQuery.refetch,
  ]);

  const originalSubtitleTracks: SubtitleTrackItem[] = metadata?.tracks ?? [];

  // 加载数据库中的 AI 字幕翻译记录
  const translationsQuery = useQuery(
    (_ctx) => getSubtitleTranslationsUseCase.execute(infoHash, fileId),
    [infoHash, fileId, getSubtitleTranslationsUseCase],
    {
      enabled: !!metadata,
    },
  );

  const aiTracks: SubtitleTrackItem[] = useMemo(() => {
    const records = translationsQuery.data ?? [];
    return records.map((record) => {
      const originalTrack = originalSubtitleTracks.find(
        (t) => t.id === record.original_track_id,
      );
      const sourceTitle =
        originalTrack?.title || `轨道 ${record.original_track_id}`;
      return {
        id: record.id,
        language: record.target_lang,
        title: `AI · ${sourceTitle}`,
        codec: "ai-translated-vtt",
        isAi: true,
      };
    });
  }, [translationsQuery.data, originalSubtitleTracks]);

  const subtitleTracks: SubtitleTrackItem[] = useMemo(() => {
    return [...originalSubtitleTracks, ...aiTracks];
  }, [originalSubtitleTracks, aiTracks]);

  return {
    streamUrl,
    metadata,
    originalSubtitleTracks,
    subtitleTracks,
    chapters: metadata?.chapters ?? [],
    videoInfo: metadata?.video_info ?? null,
  };
}

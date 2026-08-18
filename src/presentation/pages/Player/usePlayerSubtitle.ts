import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { useMutation } from "@/presentation/hooks/useMutation";
import { formatError } from "@/utils";

/** 最终呈现给用户的字幕轨道：原始轨道 + AI 翻译轨道 */
export interface SubtitleTrackItem {
  /** 原始轨道为数字 id，AI 翻译轨道为 UUID */
  id: number | string;
  language: string;
  title: string;
  codec: string;
  isAi?: boolean;
}

export interface SubtitleSource {
  url: NonEmptyString;
  loadedAtFraction: number | null;
  loadedWhenFinished: boolean;
}

interface SubtitleVttDto {
  infoHash: NonEmptyString;
  fileId: number;
  trackId: number | string;
}

interface UsePlayerSubtitleParams {
  infoHash: NonEmptyString;
  fileId: number;
  originalSubtitleTracks: SubtitleTrackItem[];
  torrentStatus: TorrentStatusInfo | null;
  downloadProgress: number;
}

export function usePlayerSubtitle({
  infoHash,
  fileId,
  originalSubtitleTracks,
  torrentStatus,
  downloadProgress,
}: UsePlayerSubtitleParams) {
  const { getSubtitleVttUseCase } = useDI();
  const [subtitleSources, setSubtitleSources] = useState<
    Record<number | string, SubtitleSource>
  >({});
  const subtitleSourcesRef = useRef<Record<number | string, SubtitleSource>>(
    {},
  );
  const [selectedTrackId, setSelectedTrackId] = useState<
    number | string | null
  >(null);
  const torrentStatusRef = useRef(torrentStatus);
  torrentStatusRef.current = torrentStatus;
  // 记录当前正在加载的字幕轨道，避免自动刷新在请求挂起时发起重复请求
  const pendingSubtitleRef = useRef<number | string | null>(null);

  const subtitleMutation = useMutation<string, SubtitleVttDto>(
    (_ctx, dto) => getSubtitleVttUseCase.execute(dto),
    {
      onSuccess: (vtt, dto) => {
        pendingSubtitleRef.current = null;
        const url = NonEmptyStringSchema.parse(
          URL.createObjectURL(new Blob([vtt], { type: "text/vtt" })),
        );
        const prev = subtitleSourcesRef.current[dto.trackId];
        const status = torrentStatusRef.current;
        const next = {
          ...subtitleSourcesRef.current,
          [dto.trackId]: {
            url,
            loadedAtFraction:
              status && status.total_bytes > 0
                ? status.progress_bytes / status.total_bytes
                : null,
            loadedWhenFinished: status?.finished ?? false,
          },
        };
        subtitleSourcesRef.current = next;
        setSubtitleSources(next);
        if (prev?.url) URL.revokeObjectURL(prev.url);
      },
      onError: (error) => {
        pendingSubtitleRef.current = null;
        toast.error(`加载字幕失败: ${formatError(error)}`);
      },
    },
  );

  const loadSubtitleVtt = useCallback(
    (trackId: number | string, opts: { force?: boolean } = {}) => {
      if (!opts.force && subtitleSourcesRef.current[trackId]) return;
      if (pendingSubtitleRef.current === trackId) return;
      pendingSubtitleRef.current = trackId;
      subtitleMutation.execute({
        infoHash: NonEmptyStringSchema.parse(infoHash),
        fileId,
        trackId,
      });
    },
    [infoHash, fileId, subtitleMutation.execute],
  );

  const patchSubtitleSource = useCallback(
    (
      trackId: number | string,
      patch: Partial<
        Pick<SubtitleSource, "loadedAtFraction" | "loadedWhenFinished">
      >,
    ) => {
      const current = subtitleSourcesRef.current[trackId];
      const next = {
        ...subtitleSourcesRef.current,
        [trackId]: { ...current, ...patch },
      };
      subtitleSourcesRef.current = next;
      setSubtitleSources(next);
    },
    [],
  );

  // Clean up subtitle object URLs on unmount
  useEffect(() => {
    return () => {
      for (const source of Object.values(subtitleSourcesRef.current)) {
        URL.revokeObjectURL(source.url);
      }
      subtitleSourcesRef.current = {};
    };
  }, []);

  // Auto-select and load the first subtitle track once available
  useEffect(() => {
    if (!originalSubtitleTracks.length || selectedTrackId !== null) return;
    const first = originalSubtitleTracks[0];
    setSelectedTrackId(first.id);
    loadSubtitleVtt(first.id);
  }, [originalSubtitleTracks, selectedTrackId, loadSubtitleVtt]);

  const handleSubtitleChange = useCallback(
    (trackId: string) => {
      if (!trackId) {
        setSelectedTrackId(null);
        return;
      }
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          trackId,
        );
      const id = isUuid ? trackId : parseInt(trackId, 10);
      setSelectedTrackId(id);
      loadSubtitleVtt(id, { force: true });
    },
    [loadSubtitleVtt],
  );

  // Auto-refresh the selected subtitle track as the download progresses
  useEffect(() => {
    if (selectedTrackId === null) return;
    if (typeof selectedTrackId === "string") return;
    const existing = subtitleSourcesRef.current[selectedTrackId];
    if (!existing || downloadProgress <= 0) return;

    const fraction = downloadProgress / 100;
    if (existing.loadedAtFraction === null) {
      patchSubtitleSource(selectedTrackId, {
        loadedAtFraction: fraction,
        loadedWhenFinished: torrentStatus?.finished,
      });
      return;
    }

    const needsRefresh =
      (torrentStatus?.finished && !existing.loadedWhenFinished) ||
      fraction - existing.loadedAtFraction >= 0.1;
    if (needsRefresh) {
      loadSubtitleVtt(selectedTrackId, { force: true });
    }
  }, [
    downloadProgress,
    torrentStatus?.finished,
    selectedTrackId,
    loadSubtitleVtt,
    patchSubtitleSource,
  ]);

  return {
    subtitleSources,
    selectedTrackId,
    subtitleMutation,
    handleSubtitleChange,
    loadSubtitleVtt,
  };
}

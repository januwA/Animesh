import {
  Activity,
  ArrowLeft,
  Clipboard,
  Download,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import type {
  ChapterInfo,
  VideoMetadata,
} from "@/domain/torrent/TorrentSchemas";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { Progress } from "@/presentation/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { formatBytes, formatError, formatPlaybackTime } from "@/utils";
import "@videojs/react/video/skin.css";
import {
  createPlayer,
  selectError,
  selectTime,
  videoFeatures,
} from "@videojs/react";
import { Video, VideoSkin } from "@videojs/react/video";
import { useTorrentStatus } from "@/presentation/context/TorrentStatusContext";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";

const JsPlayer = createPlayer({ features: videoFeatures });

interface SubtitleVttDto {
  infoHash: string;
  fileId: number;
  trackId: number;
}

interface SubtitleSource {
  url: string;
  loadedAtFraction: number | null;
  loadedWhenFinished: boolean;
}

const playerParamsSchema = z.object({
  infoHash: z.string().trim().min(1, "缺少种子哈希参数"),
  fileId: z.preprocess(
    (value) =>
      typeof value === "string" && value !== "" ? Number(value) : value,
    z.number({ message: "文件 ID 必须是数字" }).int("文件 ID 必须是整数"),
  ),
  title: z.string().default(""),
  fileName: z.string().default("正在播放"),
});

type PlayerParams = z.infer<typeof playerParamsSchema>;

export default function Player() {
  const { infoHash, fileId } = useParams<{
    infoHash: string;
    fileId: string;
  }>();
  const [searchParams] = useSearchParams();

  const parsed = playerParamsSchema.safeParse({
    infoHash,
    fileId,
    title: searchParams.get("title") ?? undefined,
    fileName: searchParams.get("fileName") ?? undefined,
  });
  if (!parsed.success) {
    return (
      <InvalidParamsView title="无效的视频播放参数" error={parsed.error} />
    );
  }

  return <PlayerShell {...parsed.data} />;
}

function PlayerShell({ infoHash, fileId, title, fileName }: PlayerParams) {
  const navigate = useNavigate();

  const {
    getTorrentStreamUrlUseCase,
    getVideoMetadataUseCase,
    getSubtitleVttUseCase,
  } = useDI();
  const { torrents } = useTorrentStatus();
  const torrentStatus = torrents.find((t) => t?.info_hash === infoHash) ?? null;
  // 下载进度百分比
  const downloadProgress =
    torrentStatus && torrentStatus.total_bytes > 0
      ? (torrentStatus.progress_bytes / torrentStatus.total_bytes) * 100
      : 0;

  // Stream URL (one-shot query keyed by infoHash + fileId)
  const streamUrlQuery = useQuery<string>(
    (_ctx) => getTorrentStreamUrlUseCase.execute(infoHash, fileId),
    [infoHash, fileId, getTorrentStreamUrlUseCase],
    {
      onError: (error) =>
        toast.error(`无法获取视频流: ${formatError(error)}`, {
          duration: 10000,
        }),
    },
  );

  // Video metadata (subtitle tracks + chapters + video info), single query.
  // The backend single-flights concurrent attempts, so polling is cheap.
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

  const subtitleTracks = metadata?.tracks ?? [];
  const chapters = metadata?.chapters ?? [];
  const videoInfo = metadata?.video_info ?? null;

  // Subtitle VTT sources (lazy per-track load + auto-refresh as download progresses)
  const [subtitleSources, setSubtitleSources] = useState<
    Record<number, SubtitleSource>
  >({});
  const subtitleSourcesRef = useRef<Record<number, SubtitleSource>>({});
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const torrentStatusRef = useRef(torrentStatus);
  torrentStatusRef.current = torrentStatus;
  const pendingSubtitleRef = useRef<number | null>(null);

  const subtitleMutation = useMutation<string, SubtitleVttDto>(
    (_ctx, dto) => getSubtitleVttUseCase.execute(dto),
    {
      onSuccess: (vtt, dto) => {
        pendingSubtitleRef.current = null;
        const url = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
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
    (trackId: number, opts: { force?: boolean } = {}) => {
      if (!opts.force && subtitleSourcesRef.current[trackId]) return;
      if (pendingSubtitleRef.current === trackId) return;
      pendingSubtitleRef.current = trackId;
      subtitleMutation.execute({
        infoHash,
        fileId,
        trackId,
      });
    },
    [infoHash, fileId, subtitleMutation.execute],
  );

  const patchSubtitleSource = useCallback(
    (
      trackId: number,
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
        if (source.url) URL.revokeObjectURL(source.url);
      }
      subtitleSourcesRef.current = {};
    };
  }, []);

  // Auto-select and load the first subtitle track once available
  useEffect(() => {
    if (!subtitleTracks.length || selectedTrackId !== null) return;
    const first = subtitleTracks[0];
    setSelectedTrackId(first.id);
    loadSubtitleVtt(first.id);
  }, [subtitleTracks, selectedTrackId, loadSubtitleVtt]);

  const handleSubtitleChange = useCallback(
    (trackId: string) => {
      const id = trackId ? parseInt(trackId, 10) : null;
      setSelectedTrackId(id);
      if (id !== null) loadSubtitleVtt(id, { force: true });
    },
    [loadSubtitleVtt],
  );

  // Auto-refresh the selected subtitle track as the download progresses
  useEffect(() => {
    if (selectedTrackId === null) return;
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

  const handleCopyStreamUrl = async () => {
    if (!streamUrl) return;
    try {
      await navigator.clipboard.writeText(streamUrl);
      toast.success("视频流地址已复制到剪贴板，可在外部播放器中播放");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const streamUrl = streamUrlQuery.data;
  const canPlay = !!streamUrl && !!torrentStatus && downloadProgress >= 1;

  return (
    <JsPlayer.Provider>
      <div className="w-full flex flex-col gap-4 lg:gap-6 animate-in fade-in duration-300">
        {/* Navigation Header */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-2 text-muted-foreground hover:text-foreground w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>

        {/* Player Video */}
        <div className="relative w-full aspect-video max-h-dvh overflow-hidden rounded-xl">
          {canPlay ? (
            <VideoSkin className="w-full h-full">
              <Video src={streamUrl} playsInline>
                {subtitleTracks
                  .filter((t) => t.id === selectedTrackId)
                  .map((track) => {
                    const source = subtitleSources[track.id];
                    return (
                      <track
                        key={source?.url ?? track.id}
                        id={track.id.toString()}
                        kind="subtitles"
                        src={source?.url || undefined}
                        srcLang={track.language}
                        label={track.title}
                        default
                      />
                    );
                  })}
              </Video>
            </VideoSkin>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            </div>
          )}
        </div>

        {/* Title & Actions */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h1
              className="text-xl sm:text-2xl font-bold text-foreground wrap-break-word"
              title={fileName}
            >
              {fileName}
            </h1>
            <p className="text-sm text-muted-foreground">来自种子: {title}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {subtitleTracks.length > 0 && (
              <>
                <span className="text-xs text-muted-foreground shrink-0">
                  字幕:
                </span>
                <Select
                  value={selectedTrackId?.toString() ?? ""}
                  onValueChange={handleSubtitleChange}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="选择字幕" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">关闭</SelectItem>
                    {subtitleTracks.map((track) => (
                      <SelectItem key={track.id} value={track.id.toString()}>
                        {track.title || `轨道 ${track.id}`} ({track.language})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subtitleMutation.loading && (
                  <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
                )}
              </>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyStreamUrl}
              className="h-8 gap-1 text-muted-foreground hover:text-foreground"
            >
              <Clipboard className="h-4 w-4" />
              复制视频流地址
            </Button>
          </div>
        </div>

        {/* Chapters */}
        {chapters.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/50 p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">章节</h2>
            <div className="flex flex-col divide-y divide-border">
              {chapters.map((chapter, index) => (
                <ChapterButton
                  key={chapter.start_ms}
                  chapter={chapter}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

        {/* Media Info */}
        {videoInfo && (
          <div className="rounded-xl border border-border bg-muted/50 p-4 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-foreground">媒体信息</h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <Card className="bg-muted/50 border-border">
                <CardContent className="flex flex-col items-center justify-center p-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-center">
                    创建时间
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-center">
                    {videoInfo.date_utc !== null
                      ? new Date(videoInfo.date_utc * 1000).toLocaleString()
                      : "未知"}
                  </span>
                </CardContent>
              </Card>
              <Card className="bg-muted/50 border-border">
                <CardContent className="flex flex-col items-center justify-center p-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-center">
                    视频轨道
                  </span>
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {videoInfo.video_tracks.length > 0
                      ? videoInfo.video_tracks
                          .map((t) => `${t.codec} ${t.width}x${t.height}`)
                          .join(" / ")
                      : "无"}
                  </span>
                </CardContent>
              </Card>
              <Card className="bg-muted/50 border-border">
                <CardContent className="flex flex-col items-center justify-center p-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-center">
                    音频轨道
                  </span>
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {videoInfo.audio_tracks.length > 0
                      ? videoInfo.audio_tracks
                          .map(
                            (t) =>
                              `${t.codec} ${t.channels}ch ${t.sampling_rate}Hz`,
                          )
                          .join(" / ")
                      : "无"}
                  </span>
                </CardContent>
              </Card>
              <Card className="bg-muted/50 border-border col-span-2 sm:col-span-1">
                <CardContent className="flex flex-col items-center justify-center p-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-center">
                    封装工具
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-center break-all">
                    {videoInfo.muxing_app || "未知"}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-center break-all">
                    {videoInfo.writing_app || "未知"}
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Progress & Stats */}
        <div className="rounded-xl border border-border bg-muted/50 p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2 text-xs sm:text-sm font-medium">
              <span className="flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary animate-pulse" />
                下载进度:{" "}
                {torrentStatus
                  ? `${downloadProgress.toFixed(2)}%`
                  : "计算中..."}
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" />
                速度:{" "}
                {torrentStatus
                  ? `${formatBytes(torrentStatus.download_speed_bytes_per_sec)}/s (连接: ${torrentStatus.peers_connected}/${torrentStatus.peers_total})`
                  : "0 B/s"}
              </span>
            </div>
            <Progress
              value={torrentStatus ? downloadProgress : 0}
              className="h-2"
            />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Card className="bg-muted/50 border-border">
              <CardContent className="flex flex-col items-center justify-center p-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-center">
                  已下载
                </span>
                <span className="text-sm font-semibold whitespace-nowrap">
                  {torrentStatus
                    ? formatBytes(torrentStatus.progress_bytes)
                    : "0 B"}
                </span>
              </CardContent>
            </Card>
            <Card className="bg-muted/50 border-border">
              <CardContent className="flex flex-col items-center justify-center p-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-center">
                  总大小
                </span>
                <span className="text-sm font-semibold whitespace-nowrap">
                  {torrentStatus
                    ? formatBytes(torrentStatus.total_bytes)
                    : "0 B"}
                </span>
              </CardContent>
            </Card>
            <Card className="bg-muted/50 border-border">
              <CardContent className="flex flex-col items-center justify-center p-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-center">
                  同伴 (连接/总数)
                </span>
                <span className="text-sm font-semibold whitespace-nowrap">
                  {torrentStatus
                    ? `${torrentStatus.peers_connected} / ${torrentStatus.peers_total}`
                    : "0 / 0"}
                </span>
              </CardContent>
            </Card>
            <Card className="bg-muted/50 border-border">
              <CardContent className="flex flex-col items-center justify-center p-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-center">
                  状态
                </span>
                <span className="text-sm font-semibold text-primary whitespace-nowrap">
                  {torrentStatus
                    ? torrentStatus.finished
                      ? "已完成"
                      : "正在缓存..."
                    : "连接中..."}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Tracker 列表 */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-foreground">
              Tracker 服务器
            </h3>
            {torrentStatus && torrentStatus.trackers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {torrentStatus.trackers.map((tracker) => (
                  <span
                    key={tracker}
                    className="font-mono text-muted-foreground bg-secondary/50 border border-border rounded-full px-2 py-0.5 wrap-break-word"
                  >
                    {tracker}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">暂无 Tracker 信息</p>
            )}
          </div>
        </div>
      </div>

      {canPlay && <JsPlayerErrorMonitor />}
    </JsPlayer.Provider>
  );
}

function JsPlayerErrorMonitor() {
  const errorState = JsPlayer.usePlayer(selectError);
  const { logger } = useDI();
  const monitorLogger = useMemo(() => logger.withCategory("Player"), [logger]);
  const lastErrorRef = useRef<object | null>(null);

  useEffect(() => {
    const error = errorState?.error ?? null;
    if (error) {
      // v8 ignore next
      if (lastErrorRef.current === error) return;
      lastErrorRef.current = error;
      monitorLogger.error("Video element error:", error);

      let errorMsg = "视频加载失败";
      if (error.code === 4) {
        errorMsg =
          "当前浏览器不支持播放该格式（例如 MKV 容器），建议点击上方按钮\u201c用系统播放器播放\u201d。";
      } else if (error.code === 3) {
        errorMsg = "视频解码失败，可能数据已损坏或编码不支持。";
      } else if (error.code === 2) {
        errorMsg = "视频加载超时或网络断开。";
      }
      toast.error(errorMsg, { duration: 8000 });
      errorState?.dismissError?.();
    } else {
      lastErrorRef.current = null;
    }
  }, [errorState?.error, monitorLogger, errorState?.dismissError]);

  return null;
}

interface ChapterButtonProps {
  chapter: ChapterInfo;
  index: number;
}

function ChapterButton({ chapter, index }: ChapterButtonProps) {
  const timeState = JsPlayer.usePlayer(selectTime);

  const handleClick = useCallback(() => {
    timeState?.seek(chapter.start_ms / 1000).catch(() => {
      toast.error("跳转到章节失败");
    });
  }, [timeState, chapter.start_ms]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-baseline justify-between gap-3 py-1.5 cursor-pointer hover:bg-secondary/70 px-1 rounded transition-colors text-left"
    >
      <span className="text-sm text-foreground wrap-break-word">
        <span className="text-muted-foreground mr-2">{index + 1}</span>
        {chapter.title}
      </span>
      <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">
        {formatPlaybackTime(chapter.start_ms)}
      </span>
    </button>
  );
}

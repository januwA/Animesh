import {
  ArrowLeft,
  ChevronDown,
  Clipboard,
  Download,
  Info,
  Languages,
  List,
  Loader2,
  Server,
  Upload,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import type {
  ChapterInfo,
  VideoInfo,
  VideoMetadata,
} from "@/domain/torrent/TorrentSchemas";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/presentation/components/ui/collapsible";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/presentation/components/ui/item";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/presentation/components/ui/native-select";
import { Progress } from "@/presentation/components/ui/progress";
import { formatBytes, formatError, formatPlaybackTime } from "@/utils";
import "@videojs/react/video/skin.css";
import {
  createPlayer,
  selectError,
  selectTime,
  videoFeatures,
} from "@videojs/react";
import { Video, VideoSkin } from "@videojs/react/video";
import {
  type NonEmptyString,
  NonEmptyStringSchema,
} from "@/domain/common/NonEmptyString";
import { useTorrentStatus } from "@/presentation/context/TorrentStatusContext";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";

const JsPlayer = createPlayer({ features: videoFeatures });

interface SubtitleVttDto {
  infoHash: NonEmptyString;
  fileId: number;
  trackId: number | string;
}

interface SubtitleSource {
  url: NonEmptyString;
  loadedAtFraction: number | null;
  loadedWhenFinished: boolean;
}

const playerParamsSchema = z.object({
  infoHash: NonEmptyStringSchema.min(1, "缺少种子哈希参数"),
  fileId: z.preprocess(
    (value) =>
      typeof value === "string" && value !== "" ? Number(value) : value,
    z.number({ message: "文件 ID 必须是数字" }).int("文件 ID 必须是整数"),
  ),
  title: NonEmptyStringSchema,
  fileName: NonEmptyStringSchema,
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

/** 最终呈现给用户的字幕轨道：原始轨道 + AI 翻译轨道 */
export interface SubtitleTrackItem {
  /** 原始轨道为数字 id，AI 翻译轨道为 UUID */
  id: number | string;
  language: string;
  title: string;
  codec: string;
  isAi?: boolean;
}

function PlayerShell({ infoHash, fileId, title, fileName }: PlayerParams) {
  const navigate = useNavigate();

  const {
    getTorrentStreamUrlUseCase,
    getVideoMetadataUseCase,
    getSubtitleVttUseCase,
    getSubtitleTranslationsUseCase,
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
  const chapters = metadata?.chapters ?? [];
  const videoInfo = metadata?.video_info ?? null;
  const mediaEntries = videoInfo ? buildMediaInfoEntries(videoInfo) : [];

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

  // Subtitle VTT sources (lazy per-track load + auto-refresh as download progresses)
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

  const handleOpenAiTranslatePage = () => {
    navigate(
      `/play/${infoHash}/${fileId}/ai-subtitle?title=${encodeURIComponent(
        title,
      )}&fileName=${encodeURIComponent(fileName)}`,
    );
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
                    const url = subtitleSources[track.id]?.url;
                    return (
                      <track
                        key={url ?? track.id}
                        id={track.id.toString()}
                        kind="subtitles"
                        src={url || undefined}
                        srcLang={track.language}
                        label={track.title || `轨道 ${track.id}`}
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
                <NativeSelect
                  value={selectedTrackId?.toString() ?? ""}
                  onChange={(e) => handleSubtitleChange(e.target.value)}
                  className="text-xs"
                >
                  <NativeSelectOption value="">关闭字幕</NativeSelectOption>
                  {subtitleTracks.map((track) => (
                    <NativeSelectOption
                      key={track.id}
                      value={track.id.toString()}
                    >
                      {track.title || `轨道 ${track.id}`} ({track.language})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {subtitleMutation.loading && (
                  <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
                )}
              </>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenAiTranslatePage}
              className="h-8 gap-1 text-muted-foreground hover:text-foreground"
            >
              <Languages className="h-3.5 w-3.5" />
              AI 翻译
            </Button>

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
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" />
                下载:{" "}
                {torrentStatus
                  ? `${formatBytes(torrentStatus.download_speed_bytes_per_sec)}/s`
                  : "0 B/s"}
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-info" />
                上传:{" "}
                {torrentStatus
                  ? `${formatBytes(torrentStatus.upload_speed_bytes_per_sec)}/s (连接: ${torrentStatus.peers_connected}/${torrentStatus.peers_total})`
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
        </div>

        {/* Tracker 列表 */}
        <CollapsibleSection
          title="Tracker 服务器"
          icon={<Server className="h-4 w-4 text-muted-foreground" />}
          badge={torrentStatus?.trackers.length || undefined}
        >
          {torrentStatus && torrentStatus.trackers.length > 0 ? (
            <ItemGroup>
              {torrentStatus.trackers.map((tracker) => (
                <Item key={tracker} variant="outline" size="sm">
                  <ItemContent>
                    <ItemTitle className="truncate font-mono">
                      {tracker}
                    </ItemTitle>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          ) : (
            <p className="text-xs text-muted-foreground">暂无 Tracker 信息</p>
          )}
        </CollapsibleSection>

        {/* Chapters */}
        {chapters.length > 0 && (
          <CollapsibleSection
            title="章节"
            icon={<List className="h-4 w-4 text-muted-foreground" />}
            badge={chapters.length}
          >
            <div className="flex flex-col divide-y divide-border">
              {chapters.map((chapter, index) => (
                <ChapterButton
                  key={chapter.start_ms}
                  chapter={chapter}
                  index={index}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Media Info */}
        {videoInfo && (
          <CollapsibleSection
            title="媒体信息"
            icon={<Info className="h-4 w-4 text-muted-foreground" />}
          >
            <div className="flex flex-col divide-y divide-border">
              {mediaEntries.map((entry) => (
                <div key={entry.label} className="flex flex-col gap-1 py-2">
                  <span className="tracking-wider text-muted-foreground">
                    {entry.label}
                  </span>
                  <span className="font-semibold wrap-break-word">
                    {entry.lines.map((line, i) => (
                      <Fragment key={line.key}>
                        {line.text}
                        {i < entry.lines.length - 1 && <br />}
                      </Fragment>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
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

interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  badge?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="rounded-xl border border-border bg-muted/50"
    >
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3.5 text-left">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
          {badge !== undefined && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {badge}
            </span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

interface MediaEntryLine {
  key: string;
  text: string;
}

interface MediaEntry {
  label: string;
  lines: MediaEntryLine[];
}

function toLines(...texts: string[]): MediaEntryLine[] {
  return texts.map((text, index) => ({ key: `${index}-${text}`, text }));
}

function buildMediaInfoEntries(videoInfo: VideoInfo): MediaEntry[] {
  return [
    {
      label: "创建时间",
      lines: toLines(
        videoInfo.date_utc !== null
          ? new Date(videoInfo.date_utc * 1000).toLocaleString()
          : "未知",
      ),
    },
    {
      label: "视频轨道",
      lines: toLines(
        videoInfo.video_tracks.length > 0
          ? videoInfo.video_tracks
              .map((t) => `${t.codec} ${t.width}x${t.height}`)
              .join(" / ")
          : "无",
      ),
    },
    {
      label: "音频轨道",
      lines: toLines(
        videoInfo.audio_tracks.length > 0
          ? videoInfo.audio_tracks
              .map((t) => `${t.codec} ${t.channels}ch ${t.sampling_rate}Hz`)
              .join(" / ")
          : "无",
      ),
    },
    {
      label: "封装工具",
      lines: toLines(
        videoInfo.muxing_app || "未知",
        videoInfo.writing_app || "未知",
      ),
    },
  ];
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

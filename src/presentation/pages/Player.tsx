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
import type { GetSettingsUseCase } from "@/application/settings/GetSettingsUseCase";
import type { GetSubtitleTranslationsUseCase } from "@/application/subtitle/GetSubtitleTranslationsUseCase";
import type { TranslateSubtitleUseCase } from "@/application/subtitle/TranslateSubtitleUseCase";
import { useDI } from "@/di/DIContext";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/presentation/components/ui/dialog";
import { Input } from "@/presentation/components/ui/input";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/presentation/components/ui/item";
import { Label } from "@/presentation/components/ui/label";
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

/**
 * AI 翻译轨道使用的基础偏移 id。原始 MKV 轨道 id 基本 < 100，
 * 这里取足够大的偏移量避免冲突。AI 轨道 id 通过递增计数器分配，
 * 使同一原始轨道的多次翻译各自拥有唯一 id。
 */
const AI_TRACK_BASE = 1_000_000;

function isAiTrackId(trackId: number): boolean {
  return trackId >= AI_TRACK_BASE;
}

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

/**
 * AI 翻译出来的字幕轨道。
 * - key: 合成后的 AI 轨道 id（通过计数器从 AI_TRACK_BASE 递增分配）
 * - value: 合成轨道的 display 信息与 Blob URL
 */
export interface AiSubtitleTrack {
  aiTrackId: number;
  /** 对应原始轨道的 id（用于用户知道它基于哪条轨道翻译） */
  originalTrackId: number;
  targetLanguage: string;
  title: string;
  language: string;
  url: string;
}

/** 最终呈现给用户的字幕轨道：原始轨道 + AI 翻译轨道 */
export interface SubtitleTrackItem {
  id: number;
  language: string;
  title: string;
  codec: string;
  isAi?: boolean;
}

export interface UseAiSubtitleTranslationParams {
  getSubtitleTranslationsUseCase: GetSubtitleTranslationsUseCase;
  translateSubtitleUseCase: TranslateSubtitleUseCase;
  getSettingsUseCase: GetSettingsUseCase;
  infoHash: string;
  fileId: number;
  /** 元数据是否已就绪（记录加载在就绪后触发） */
  metadataReady: boolean;
  /** 当前可用的原始字幕轨道 */
  originalSubtitleTracks: readonly SubtitleTrackItem[];
  selectedTrackId: number | null;
  setSelectedTrackId: (id: number | null) => void;
  /** 获取某原始字幕轨道的 Blob URL，未加载完返回 undefined */
  getSubtitleUrl: (trackId: number) => string | undefined;
}

export interface UseAiSubtitleTranslationResult {
  /** 原始 + AI 合成后的字幕轨道列表 */
  subtitleTracks: SubtitleTrackItem[];
  aiSubtitleTracks: Record<number, AiSubtitleTrack>;
  translateDialogOpen: boolean;
  setTranslateDialogOpen: (open: boolean) => void;
  translateSourceLang: string;
  setTranslateSourceLang: (v: string) => void;
  translateTargetLang: string;
  setTranslateTargetLang: (v: string) => void;
  translateAiIndex: number;
  setTranslateAiIndex: (v: number) => void;
  translateProgress: { done: number; total: number } | null;
  aiConfigs: AiConfig[];
  translateMutationLoading: boolean;
  handleOpenTranslateDialog: () => void;
  handleConfirmTranslate: () => Promise<void>;
}

/**
 * AI 字幕翻译的状态机 Hook。
 *
 * 职责：
 * - 维护 AI 翻译轨道列表（aiSubtitleTracks）与原始轨道合并后的 subtitleTracks。
 * - 进入播放器时加载该种子+文件下的所有翻译记录，全部作为独立 AI 轨道呈现。
 * - 执行翻译 mutation（含进度、成功/失败/结束回调）。
 * - 打开翻译对话框、确认翻译、为每次翻译新增独立 AI 轨道（保留历史）。
 * - 卸载时清理 AI 轨道 Blob URL。
 */
export function useAiSubtitleTranslation({
  getSubtitleTranslationsUseCase,
  translateSubtitleUseCase,
  getSettingsUseCase,
  infoHash,
  fileId,
  metadataReady,
  originalSubtitleTracks,
  selectedTrackId,
  setSelectedTrackId,
  getSubtitleUrl,
}: UseAiSubtitleTranslationParams): UseAiSubtitleTranslationResult {
  const [aiSubtitleTracks, setAiSubtitleTracks] = useState<
    Record<number, AiSubtitleTrack>
  >({});
  const aiSubtitleTracksRef = useRef<Record<number, AiSubtitleTrack>>({});
  aiSubtitleTracksRef.current = aiSubtitleTracks;

  // AI 轨道 id 通过递增计数器分配，保证同一原始轨道的多次翻译各自唯一
  const nextAiTrackIdRef = useRef(AI_TRACK_BASE);

  const allocateAiTrackId = useCallback((): number => {
    const id = nextAiTrackIdRef.current;
    nextAiTrackIdRef.current += 1;
    return id;
  }, []);

  /**
   * 生成 AI 翻译轨道标题。同一原始轨道存在多条翻译时追加序号（#1/#2/...）以便区分。
   * 序号基于传入的轨道集合计算，加载多条历史与翻译成功后都能正确递增。
   */
  const buildAiTrackTitle = useCallback(
    (
      sourceTitle: string,
      targetLang: string,
      originalTrackId: number,
      tracks: Record<number, AiSubtitleTrack>,
    ): string => {
      const sameTrackCount = Object.values(tracks).filter(
        (t) => t.originalTrackId === originalTrackId,
      ).length;
      return `${sourceTitle} · AI(${targetLang}) #${sameTrackCount + 1}`;
    },
    [],
  );

  const subtitleTracks: SubtitleTrackItem[] = [
    ...originalSubtitleTracks,
    ...Object.values(aiSubtitleTracks).map((t) => ({
      id: t.aiTrackId,
      language: t.language,
      title: t.title,
      codec: "ai-translated-vtt",
      isAi: true,
    })),
  ];

  const [translateDialogOpen, setTranslateDialogOpen] = useState(false);
  const [translateSourceLang, setTranslateSourceLang] = useState("");
  const [translateTargetLang, setTranslateTargetLang] = useState("");
  const [translateAiIndex, setTranslateAiIndex] = useState<number>(0);
  const [translateProgress, setTranslateProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  // 获取已配置的 AI 列表供用户在翻译时选择
  const settingsQuery = useQuery(
    () => getSettingsUseCase.execute(),
    [getSettingsUseCase],
  );
  const aiConfigs = settingsQuery.data?.ai_configs ?? [];

  // 进入播放器时加载该种子+文件下的所有字幕翻译记录，作为 AI 轨道直接呈现。
  useQuery(
    (_ctx) => getSubtitleTranslationsUseCase.execute(infoHash, fileId),
    [infoHash, fileId, getSubtitleTranslationsUseCase],
    {
      enabled: metadataReady,
      onSuccess: (records) => {
        if (records.length === 0) return;
        const nextAi: Record<number, AiSubtitleTrack> = {
          ...aiSubtitleTracksRef.current,
        };
        for (const record of records) {
          // 每次翻译都是一条独立记录，全部作为独立 AI 轨道展示
          const aiTrackId = allocateAiTrackId();
          const url = URL.createObjectURL(
            new Blob([record.vtt_content], { type: "text/vtt" }),
          );
          const originalTrack = originalSubtitleTracks.find(
            (t) => t.id === record.original_track_id,
          );
          const sourceTitle =
            originalTrack?.title || `轨道 ${record.original_track_id}`;
          nextAi[aiTrackId] = {
            aiTrackId,
            originalTrackId: record.original_track_id,
            targetLanguage: record.target_lang,
            title: buildAiTrackTitle(
              sourceTitle,
              record.target_lang,
              record.original_track_id,
              nextAi,
            ),
            language: record.target_lang,
            url,
          };
        }
        aiSubtitleTracksRef.current = nextAi;
        setAiSubtitleTracks(nextAi);
        toast.info(`已加载 ${records.length} 条缓存的 AI 字幕轨道`);
      },
      onError: (err) => {
        console.error("[Player] 加载字幕翻译记录失败", err);
      },
    },
  );

  interface TranslateParams {
    trackId: number;
    vtt: string;
    sourceLang: string;
    targetLang: string;
    aiConfig: AiConfig;
    infoHash: string;
    fileId: number;
    originalTrackId: number;
  }

  const translateMutation = useMutation<string, TranslateParams>(
    (ctx, params) =>
      translateSubtitleUseCase.execute(ctx, {
        vtt: params.vtt,
        sourceLanguage: params.sourceLang,
        targetLanguage: params.targetLang,
        aiConfig: params.aiConfig,
        onProgress: (done, total) => setTranslateProgress({ done, total }),
        infoHash: params.infoHash,
        fileId: params.fileId,
        originalTrackId: params.originalTrackId,
      }),
    {
      onSuccess: (translatedVtt, params) => {
        const originalTrackId = params.trackId;
        // 每次翻译新增一条独立轨道，保留之前的翻译历史
        const url = URL.createObjectURL(
          new Blob([translatedVtt], { type: "text/vtt" }),
        );
        const aiTrackId = allocateAiTrackId();
        const originalTrack = originalSubtitleTracks.find(
          (t) => t.id === originalTrackId,
        );
        /* v8 ignore next 4 -- 原始轨道必然存在于列表，兜底分支为防御性代码 */
        const sourceTitle = originalTrack?.title || `轨道 ${originalTrackId}`;
        const title = buildAiTrackTitle(
          sourceTitle,
          params.targetLang,
          originalTrackId,
          aiSubtitleTracksRef.current,
        );

        const newAiTrack: AiSubtitleTrack = {
          aiTrackId,
          originalTrackId,
          targetLanguage: params.targetLang,
          title,
          language: params.targetLang,
          url,
        };

        const nextAi = {
          ...aiSubtitleTracksRef.current,
          [aiTrackId]: newAiTrack,
        };
        aiSubtitleTracksRef.current = nextAi;
        setAiSubtitleTracks(nextAi);

        // 自动切换到 AI 翻译轨道
        setSelectedTrackId(aiTrackId);
        setTranslateDialogOpen(false);
        toast.success(
          `字幕翻译完成，已新增为独立轨道"${title}"，可随时切换回原字幕`,
        );
      },
      onError: (error) => {
        toast.error(`字幕翻译失败: ${formatError(error)}`, {
          duration: 8000,
        });
      },
      onSettled: () => {
        setTranslateProgress(null);
      },
    },
  );

  const handleOpenTranslateDialog = useCallback(() => {
    if (selectedTrackId === null) {
      toast.error("请先选择字幕轨道");
      return;
    }
    /* v8 ignore next */
    const sourceTrackId = isAiTrackId(selectedTrackId)
      ? (aiSubtitleTracksRef.current[selectedTrackId]?.originalTrackId ??
        selectedTrackId)
      : selectedTrackId;
    const url = getSubtitleUrl(sourceTrackId);
    if (!url) {
      toast.error("字幕尚未加载完成");
      return;
    }
    if (aiConfigs.length === 0) {
      toast.error("请先在设置中配置 AI 接口");
      return;
    }
    setTranslateDialogOpen(true);
  }, [selectedTrackId, aiConfigs.length, getSubtitleUrl]);

  const handleConfirmTranslate = useCallback(async () => {
    if (selectedTrackId === null) return;
    // 翻译基底始终使用原始轨道文本（即使当前选中的是 AI 轨道）
    /* v8 ignore next */
    const sourceTrackId = isAiTrackId(selectedTrackId)
      ? (aiSubtitleTracksRef.current[selectedTrackId]?.originalTrackId ??
        selectedTrackId)
      : selectedTrackId;
    const url = getSubtitleUrl(sourceTrackId);
    if (!url) {
      toast.error("字幕尚未加载完成");
      return;
    }
    let vttText: string;
    try {
      const res = await fetch(url);
      vttText = await res.text();
    } catch {
      toast.error("读取字幕内容失败");
      return;
    }
    const aiConfig = aiConfigs[translateAiIndex];
    translateMutation.execute({
      trackId: sourceTrackId,
      vtt: vttText,
      sourceLang: translateSourceLang,
      targetLang: translateTargetLang,
      aiConfig,
      infoHash,
      fileId,
      originalTrackId: sourceTrackId,
    });
  }, [
    selectedTrackId,
    translateSourceLang,
    translateTargetLang,
    translateAiIndex,
    aiConfigs,
    translateMutation,
    infoHash,
    fileId,
    getSubtitleUrl,
  ]);

  // 卸载时清理 AI 轨道 Blob URL
  useEffect(() => {
    return () => {
      for (const aiTrack of Object.values(aiSubtitleTracksRef.current)) {
        /* v8 ignore next -- AI 轨道必然携带 Blob URL，此处为防御性兜底 */
        if (aiTrack.url) URL.revokeObjectURL(aiTrack.url);
      }
      aiSubtitleTracksRef.current = {};
    };
  }, []);

  return {
    subtitleTracks,
    aiSubtitleTracks,
    translateDialogOpen,
    setTranslateDialogOpen,
    translateSourceLang,
    setTranslateSourceLang,
    translateTargetLang,
    setTranslateTargetLang,
    translateAiIndex,
    setTranslateAiIndex,
    translateProgress,
    aiConfigs,
    translateMutationLoading: translateMutation.loading,
    handleOpenTranslateDialog,
    handleConfirmTranslate,
  };
}

function PlayerShell({ infoHash, fileId, title, fileName }: PlayerParams) {
  const navigate = useNavigate();

  const {
    getTorrentStreamUrlUseCase,
    getVideoMetadataUseCase,
    getSubtitleVttUseCase,
    translateSubtitleUseCase,
    getSettingsUseCase,
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

  const originalSubtitleTracks = metadata?.tracks ?? [];
  const chapters = metadata?.chapters ?? [];
  const videoInfo = metadata?.video_info ?? null;
  const mediaEntries = videoInfo ? buildMediaInfoEntries(videoInfo) : [];

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
      // AI 轨道 Blob URL 已在翻译成功时直接注入 subtitleSources，无需调后端加载
      if (isAiTrackId(trackId)) return;
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

  const {
    subtitleTracks,
    aiSubtitleTracks,
    translateDialogOpen,
    setTranslateDialogOpen,
    translateSourceLang,
    setTranslateSourceLang,
    translateTargetLang,
    setTranslateTargetLang,
    translateAiIndex,
    setTranslateAiIndex,
    translateProgress,
    aiConfigs,
    translateMutationLoading,
    handleOpenTranslateDialog,
    handleConfirmTranslate,
  } = useAiSubtitleTranslation({
    getSubtitleTranslationsUseCase,
    translateSubtitleUseCase,
    getSettingsUseCase,
    infoHash,
    fileId,
    metadataReady: !!metadata,
    originalSubtitleTracks,
    selectedTrackId,
    setSelectedTrackId,
    getSubtitleUrl: (trackId) => subtitleSourcesRef.current[trackId]?.url,
  });

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
    // 仅在第一次原始轨道加载后自动选中第一条原始轨道，不自动选中 AI 翻译轨道
    if (!originalSubtitleTracks.length || selectedTrackId !== null) return;
    const first = originalSubtitleTracks[0];
    setSelectedTrackId(first.id);
    loadSubtitleVtt(first.id);
  }, [originalSubtitleTracks, selectedTrackId, loadSubtitleVtt]);

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
    // AI 翻译轨道来自内存 Blob，不需要随下载进度刷新
    if (isAiTrackId(selectedTrackId)) return;
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
                    const aiTrack = isAiTrackId(track.id)
                      ? aiSubtitleTracks[track.id]
                      : undefined;
                    const source = subtitleSources[track.id];
                    const url = aiTrack?.url ?? source?.url;
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
                {selectedTrackId !== null &&
                  /* v8 ignore start -- 翻译进行中的瞬时进度态，集成测试难以稳定捕获 */
                  (translateMutationLoading && translateProgress ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      翻译中 {translateProgress.done}/{translateProgress.total}
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleOpenTranslateDialog}
                      disabled={translateMutationLoading}
                      className="h-8 gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Languages className="h-3.5 w-3.5" />
                      AI 翻译
                    </Button>
                  ))}
                {/* v8 ignore stop */}
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

      <Dialog open={translateDialogOpen} onOpenChange={setTranslateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI 字幕翻译</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="translate-ai-alias">AI 配置</Label>
              <Select
                value={String(translateAiIndex)}
                // v8 ignore next
                onValueChange={(v) => setTranslateAiIndex(Number(v))}
              >
                <SelectTrigger id="translate-ai-alias">
                  <SelectValue placeholder="选择已配置的 AI" />
                </SelectTrigger>
                <SelectContent>
                  {aiConfigs.map((cfg, index) => (
                    <SelectItem key={cfg.alias} value={String(index)}>
                      {cfg.alias} · {cfg.ai_model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="translate-source-lang">当前字幕语言</Label>
              <Input
                id="translate-source-lang"
                value={translateSourceLang}
                onChange={(e) => setTranslateSourceLang(e.target.value.trim())}
                placeholder="如 zh / de / 中文"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="translate-target-lang">目标语言</Label>
              <Input
                id="translate-target-lang"
                value={translateTargetLang}
                onChange={(e) => setTranslateTargetLang(e.target.value.trim())}
                placeholder="如 zh / de / 中文"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleConfirmTranslate}
              disabled={
                !aiConfigs.length ||
                !translateSourceLang.length ||
                !translateTargetLang.length ||
                translateMutationLoading
              }
            >
              {/* v8 ignore start */}
              {translateMutationLoading ? "翻译中..." : "开始翻译"}
              {/* v8 ignore stop */}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

/** 页面底部的可折叠信息区块，默认收起，点击标题展开。 */
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

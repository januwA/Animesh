import { useState } from "react";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import type { SubtitleTrackInfo } from "@/domain/torrent/TorrentSchemas";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";
import { formatError } from "@/utils";

export interface UseAiTranslationFormParams {
  infoHash: NonEmptyString;
  fileId: number;
  onTranslateSuccess: () => void;
}

export interface UseAiTranslationFormResult {
  aiConfigs: AiConfig[];
  originalTracks: SubtitleTrackInfo[];
  selectedTrackId: number | null;
  setSelectedTrackId: (id: number | null) => void;
  selectedAiIndex: number;
  setSelectedAiIndex: (index: number) => void;
  sourceLang: string;
  setSourceLang: (value: string) => void;
  targetLang: string;
  setTargetLang: (value: string) => void;
  translateProgress: { done: number; total: number } | null;
  translateLoading: boolean;
  handleTranslate: () => void;
}

export function useAiTranslationForm(
  params: UseAiTranslationFormParams,
): UseAiTranslationFormResult {
  const { infoHash, fileId, onTranslateSuccess } = params;
  const {
    getAiConfigsUseCase,
    getVideoMetadataUseCase,
    getSubtitleVttUseCase,
    translateSubtitleUseCase,
  } = useDI();

  const [sourceLang, setSourceLang] = useState("");
  const [targetLang, setTargetLang] = useState("");
  const [selectedAiIndex, setSelectedAiIndex] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [translateProgress, setTranslateProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const aiConfigsQuery = useQuery(
    () => getAiConfigsUseCase.execute(),
    [getAiConfigsUseCase],
  );
  const aiConfigs: AiConfig[] = aiConfigsQuery.data?.aiConfigs ?? [];

  const metadataQuery = useQuery(
    (_ctx) => getVideoMetadataUseCase.execute(infoHash, fileId),
    [infoHash, fileId, getVideoMetadataUseCase],
  );
  const originalTracks: SubtitleTrackInfo[] = metadataQuery.data?.tracks ?? [];

  const translateMutation = useMutation<string, void>(
    async (ctx) => {
      // v8 ignore start
      if (selectedTrackId === null) {
        throw new Error("请先选择一条原始字幕轨道");
      }
      if (!aiConfigs.length) {
        throw new Error("请先在设置中配置 AI 接口");
      }
      if (!sourceLang.trim() || !targetLang.trim()) {
        throw new Error("请填写源语言和目标语言");
      }
      // v8 ignore stop

      const vttText = await getSubtitleVttUseCase.execute({
        infoHash,
        fileId,
        trackId: selectedTrackId,
      });

      const aiConfig = aiConfigs[selectedAiIndex];

      return translateSubtitleUseCase.execute(ctx, {
        vtt: vttText,
        sourceLanguage: sourceLang.trim(),
        targetLanguage: targetLang.trim(),
        aiConfig,
        onProgress: (done, total) => setTranslateProgress({ done, total }),
        infoHash,
        fileId,
        originalTrackId: selectedTrackId,
      });
    },
    {
      onSuccess: () => {
        toast.success("AI 字幕翻译成功");
        onTranslateSuccess();
      },
      onError: (err) => {
        toast.error(`翻译失败: ${formatError(err)}`, { duration: 8000 });
      },
      onSettled: () => {
        setTranslateProgress(null);
      },
    },
  );

  return {
    aiConfigs,
    originalTracks,
    selectedTrackId,
    setSelectedTrackId,
    selectedAiIndex,
    setSelectedAiIndex,
    sourceLang,
    setSourceLang,
    targetLang,
    setTargetLang,
    translateProgress,
    translateLoading: translateMutation.loading,
    handleTranslate: () => translateMutation.execute(),
  };
}

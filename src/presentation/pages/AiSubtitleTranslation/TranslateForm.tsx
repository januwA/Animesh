import { Languages, Loader2, Sparkles } from "lucide-react";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import type { SubtitleTrackInfo } from "@/domain/torrent/TorrentSchemas";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/presentation/components/ui/native-select";

export interface TranslateFormProps {
  aiConfigs: AiConfig[];
  originalTracks: SubtitleTrackInfo[];
  selectedTrackId: number | null;
  onSelectedTrackChange: (id: number | null) => void;
  selectedAiIndex: number;
  onSelectedAiIndexChange: (index: number) => void;
  sourceLang: string;
  onSourceLangChange: (value: string) => void;
  targetLang: string;
  onTargetLangChange: (value: string) => void;
  translateProgress: { done: number; total: number } | null;
  translateLoading: boolean;
  onTranslate: () => void;
}

export function TranslateForm({
  aiConfigs,
  originalTracks,
  selectedTrackId,
  onSelectedTrackChange,
  selectedAiIndex,
  onSelectedAiIndexChange,
  sourceLang,
  onSourceLangChange,
  targetLang,
  onTargetLangChange,
  translateProgress,
  translateLoading,
  onTranslate,
}: TranslateFormProps) {
  const canTranslate =
    !translateLoading &&
    selectedTrackId !== null &&
    aiConfigs.length > 0 &&
    sourceLang.trim() !== "" &&
    targetLang.trim() !== "";

  return (
    <Card className="ani-card">
      <CardContent className="p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Languages className="h-5 w-5 text-primary" />
          发起新翻译
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="original-track">选择原始字幕轨道</Label>
            <NativeSelect
              id="original-track"
              value={selectedTrackId !== null ? String(selectedTrackId) : ""}
              onChange={(e) =>
                onSelectedTrackChange(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            >
              <NativeSelectOption value="" disabled>
                请选择原始字幕
              </NativeSelectOption>
              {originalTracks.map((track) => (
                <NativeSelectOption key={track.id} value={String(track.id)}>
                  {track.title || `轨道 ${track.id}`} ({track.language})
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-config">AI 配置</Label>
            <NativeSelect
              id="ai-config"
              value={String(selectedAiIndex)}
              onChange={(e) => onSelectedAiIndexChange(Number(e.target.value))}
            >
              <NativeSelectOption value="" disabled>
                选择 AI 配置
              </NativeSelectOption>
              {aiConfigs.map((cfg, idx) => (
                <NativeSelectOption key={cfg.alias} value={String(idx)}>
                  {cfg.alias} · {cfg.ai_model}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="translate-source-lang">当前字幕语言</Label>
            <Input
              id="translate-source-lang"
              value={sourceLang}
              onChange={(e) => onSourceLangChange(e.target.value)}
              placeholder="如 en / zh / 日语 / English"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="translate-target-lang">目标语言</Label>
            <Input
              id="translate-target-lang"
              value={targetLang}
              onChange={(e) => onTargetLangChange(e.target.value)}
              placeholder="如 zh / en / 中文 / 简体中文"
            />
          </div>
        </div>

        {translateProgress && (
          <div className="flex items-center gap-2 text-sm text-primary font-medium py-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在翻译中... (已完成 {translateProgress.done} / 总计{" "}
            {translateProgress.total} 块)
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            onClick={onTranslate}
            disabled={!canTranslate}
            className="gap-2"
          >
            {translateLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                翻译中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                开始翻译
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

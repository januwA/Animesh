import {
  ArrowLeft,
  Download,
  Languages,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import type { SubtitleTranslationRecord } from "@/domain/subtitle/SubtitleTranslationSchemas";
import type { SubtitleTrackInfo } from "@/domain/torrent/TorrentSchemas";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/presentation/components/ui/dialog";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { Textarea } from "@/presentation/components/ui/textarea";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";
import { formatError } from "@/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";

// v8 ignore start
const paramsSchema = z.object({
  infoHash: NonEmptyStringSchema.min(1, "缺少种子哈希参数"),
  fileId: z.preprocess(
    (value) =>
      typeof value === "string" && value !== "" ? Number(value) : value,
    z.number({ message: "文件 ID 必须是数字" }).int("文件 ID 必须是整数"),
  ),
  title: NonEmptyStringSchema,
});

export type ContentProps = z.infer<typeof paramsSchema>;
// v8 ignore stop

export default function AiSubtitleTranslationPage() {
  const { infoHash, fileId } = useParams<{
    infoHash: string;
    fileId: string;
  }>();
  const [searchParams] = useSearchParams();

  const parsed = paramsSchema.safeParse({
    infoHash,
    fileId,
    title: searchParams.get("title") ?? undefined,
  });

  if (!parsed.success) {
    return (
      <InvalidParamsView title="无效的字幕翻译页面参数" error={parsed.error} />
    );
  }

  return <AiSubtitleTranslationContent {...parsed.data} />;
}

function AiSubtitleTranslationContent({
  infoHash,
  fileId,
  title,
}: ContentProps) {
  const navigate = useNavigate();
  const {
    getSubtitleTranslationsUseCase,
    translateSubtitleUseCase,
    deleteSubtitleTranslationUseCase,
    saveSubtitleTranslationUseCase,
    getSubtitleTranslationByIdUseCase,
    getSettingsUseCase,
    getVideoMetadataUseCase,
    getSubtitleVttUseCase,
  } = useDI();

  const [sourceLang, setSourceLang] = useState("");
  const [targetLang, setTargetLang] = useState("");
  const [selectedAiIndex, setSelectedAiIndex] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [translateProgress, setTranslateProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  // 编辑状态
  const [editingRecord, setEditingRecord] =
    useState<SubtitleTranslationRecord | null>(null);
  const [editTargetLang, setEditTargetLang] = useState("");
  const [editVttContent, setEditVttContent] = useState("");

  // 加载设置（获取 AI 配置）
  const settingsQuery = useQuery(
    () => getSettingsUseCase.execute(),
    [getSettingsUseCase],
  );
  const aiConfigs: AiConfig[] = settingsQuery.data?.ai_configs ?? [];

  // 加载视频元数据（获取原始字幕轨道列表）
  const metadataQuery = useQuery(
    (_ctx) => getVideoMetadataUseCase.execute(infoHash, fileId),
    [infoHash, fileId, getVideoMetadataUseCase],
  );
  const originalTracks: SubtitleTrackInfo[] = metadataQuery.data?.tracks ?? [];

  // 加载已有翻译记录
  const translationsQuery = useQuery(
    (_ctx) => getSubtitleTranslationsUseCase.execute(infoHash, fileId),
    [infoHash, fileId, getSubtitleTranslationsUseCase],
  );
  const records: SubtitleTranslationRecord[] = translationsQuery.data ?? [];

  // 翻译 mutation
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

      // 1. 获取原始字幕 VTT 内容
      const vttText = await getSubtitleVttUseCase.execute({
        infoHash: NonEmptyStringSchema.parse(infoHash),
        fileId,
        trackId: selectedTrackId,
      });

      const aiConfig = aiConfigs[selectedAiIndex];

      // 2. 执行 AI 翻译
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
        translationsQuery.refetch();
      },
      onError: (err) => {
        toast.error(`翻译失败: ${formatError(err)}`, { duration: 8000 });
      },
      onSettled: () => {
        setTranslateProgress(null);
      },
    },
  );

  // 删除翻译记录 mutation
  const deleteMutation = useMutation<boolean, string>(
    async (_ctx, recordId) => {
      return deleteSubtitleTranslationUseCase.execute(recordId);
    },
    {
      onSuccess: () => {
        toast.success("已删除翻译记录");
        translationsQuery.refetch();
      },
      onError: (err) => {
        toast.error(`删除失败: ${formatError(err)}`);
      },
    },
  );

  // 保存编辑 mutation
  const saveMutation = useMutation<void, void>(
    async () => {
      // v8 ignore next
      if (!editingRecord) return;
      await saveSubtitleTranslationUseCase.execute({
        ...editingRecord,
        target_lang: NonEmptyStringSchema.parse(editTargetLang.trim()),
        vtt_content: editVttContent,
        last_accessed_at: Date.now(),
      });
    },
    {
      onSuccess: () => {
        toast.success("已更新字幕记录");
        setEditingRecord(null);
        translationsQuery.refetch();
      },
      onError: (err) => {
        toast.error(`保存失败: ${formatError(err)}`);
      },
    },
  );

  // 打开编辑对话框
  const handleOpenEdit = useCallback(
    async (record: SubtitleTranslationRecord) => {
      setEditingRecord(record);
      setEditTargetLang(record.target_lang);
      // 如果已包含完整的 vtt_content，直接使用；否则去获取
      if (record.vtt_content) {
        setEditVttContent(record.vtt_content);
      } else {
        try {
          const fullRecord = await getSubtitleTranslationByIdUseCase.execute(
            record.id,
          );
          setEditVttContent(fullRecord?.vtt_content ?? "");
        } catch {
          setEditVttContent("");
        }
      }
    },
    [getSubtitleTranslationByIdUseCase],
  );

  // 下载/导出翻译好的字幕
  const handleDownload = useCallback(
    async (record: SubtitleTranslationRecord) => {
      let content = record.vtt_content;
      if (!content) {
        try {
          const fullRecord = await getSubtitleTranslationByIdUseCase.execute(
            record.id,
          );
          content = fullRecord?.vtt_content ?? "";
        } catch {
          content = "";
        }
      }
      // v8 ignore start
      if (!content) {
        toast.error("该记录内容为空");
        return;
      }
      const blob = new Blob([content], { type: "text/vtt;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `subtitle-${record.target_lang}-${record.id.slice(0, 8)}.vtt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("字幕文件已下载");
      // v8 ignore stop
    },
    [getSubtitleTranslationByIdUseCase],
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* 顶部导航与标题 */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2 text-muted-foreground hover:text-foreground w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          返回播放器
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{title}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          AI 字幕翻译
        </h1>
        <p className="text-sm text-muted-foreground">
          选择原始字幕轨道，使用配置好的 AI
          大模型进行高质量翻译，并可在此管理、下载或清理已生成的翻译字幕。
        </p>
      </div>

      {/* 新建翻译卡片 */}
      <Card className="border-border bg-card">
        <CardContent className="p-6 flex flex-col gap-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" />
            发起新翻译
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 选择原始字幕轨道 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="original-track">选择原始字幕轨道</Label>
              <Select
                value={selectedTrackId !== null ? String(selectedTrackId) : ""}
                // v8 ignore next
                onValueChange={(v) => setSelectedTrackId(v ? Number(v) : null)}
              >
                <SelectTrigger id="original-track">
                  <SelectValue placeholder="请选择原始字幕" />
                </SelectTrigger>
                <SelectContent>
                  {originalTracks.map((track) => (
                    <SelectItem key={track.id} value={String(track.id)}>
                      {track.title || `轨道 ${track.id}`} ({track.language})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 选择 AI 配置 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-config">AI 配置</Label>
              <Select
                value={String(selectedAiIndex)}
                onValueChange={(v) => setSelectedAiIndex(Number(v))}
              >
                <SelectTrigger id="ai-config">
                  <SelectValue placeholder="选择 AI 配置" />
                </SelectTrigger>
                <SelectContent>
                  {aiConfigs.map((cfg, idx) => (
                    <SelectItem key={cfg.alias} value={String(idx)}>
                      {cfg.alias} · {cfg.ai_model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 源语言 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="translate-source-lang">当前字幕语言</Label>
              <Input
                id="translate-source-lang"
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                placeholder="如 en / zh / 日语 / English"
              />
            </div>

            {/* 目标语言 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="translate-target-lang">目标语言</Label>
              <Input
                id="translate-target-lang"
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
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
              onClick={() => translateMutation.execute()}
              disabled={
                translateMutation.loading ||
                selectedTrackId === null ||
                !aiConfigs.length ||
                !sourceLang.trim() ||
                !targetLang.trim()
              }
              className="gap-2"
            >
              {translateMutation.loading ? (
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

      {/* 已有翻译记录列表 */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">已生成的 AI 字幕翻译记录</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => translationsQuery.refetch()}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        </div>

        {translationsQuery.loading && records.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            加载翻译记录中...
          </div>
        ) : records.length === 0 ? (
          <Card className="border-border bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Languages className="h-8 w-8 text-muted-foreground/50" />
              <p>暂无 AI 翻译记录，请在上方发起翻译。</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {records.map((record) => {
              const originalTrack = originalTracks.find(
                (t) => t.id === record.original_track_id,
              );
              return (
                <Card key={record.id} className="border-border bg-card">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">
                          AI 翻译 ·{" "}
                          {originalTrack?.title ||
                            `轨道 ${record.original_track_id}`}
                        </span>
                        <span className="rounded bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                          {record.target_lang}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono truncate">
                        ID: {record.id} · 原始轨道 ID:{" "}
                        {record.original_track_id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(record)}
                            className="gap-1.5 text-xs"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            编辑
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-3/4">
                          <DialogHeader>
                            <DialogTitle>编辑 AI 字幕翻译</DialogTitle>
                          </DialogHeader>

                          <div className="flex flex-col gap-4 py-2">
                            <div className="flex flex-col gap-1.5">
                              <Label htmlFor="edit-target-lang">目标语言</Label>
                              <Input
                                id="edit-target-lang"
                                value={editTargetLang}
                                onChange={(e) =>
                                  setEditTargetLang(e.target.value)
                                }
                                placeholder="如 zh / ja / en"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">
                              <Label htmlFor="edit-vtt-content">
                                字幕 VTT 内容
                              </Label>
                              <Textarea
                                id="edit-vtt-content"
                                value={editVttContent}
                                onChange={(e) =>
                                  setEditVttContent(e.target.value)
                                }
                                rows={12}
                                className="font-mono text-xs"
                                placeholder="WEBVTT..."
                              />
                            </div>
                          </div>

                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">取消</Button>
                            </DialogClose>
                            <Button
                              onClick={() => saveMutation.execute()}
                              disabled={saveMutation.loading}
                            >
                              {saveMutation.loading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                  保存中...
                                </>
                              ) : (
                                "保存修改"
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(record)}
                        className="gap-1.5 text-xs"
                      >
                        <Download className="h-3.5 w-3.5" />
                        下载
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deleteMutation.loading}
                            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            删除
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>你绝对确定吗?</AlertDialogTitle>
                            <AlertDialogDescription>
                              删除这条资源.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.execute(record.id)}
                            >
                              继续
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

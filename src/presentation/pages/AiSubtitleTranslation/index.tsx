import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { AiSubtitleHeader } from "./AiSubtitleHeader";
import { TranslateForm } from "./TranslateForm";
import { TranslationRecordsSection } from "./TranslationRecordsSection";
import { useAiTranslationForm } from "./useAiTranslationForm";
import { useTranslationRecords } from "./useTranslationRecords";

// v8 ignore start
const paramsSchema = z.object({
  infoHash: NonEmptyStringSchema.min(1, "缺少种子哈希参数"),
  fileId: z.preprocess(
    (value) =>
      typeof value === "string" && value !== "" ? Number(value) : value,
    z.number({ message: "文件 ID 必须是数字" }).int("文件 ID 必须是整数"),
  ),
  fileName: NonEmptyStringSchema,
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
    fileName: searchParams.get("fileName") ?? undefined,
  });

  if (!parsed.success) {
    return (
      <InvalidParamsView title="无效的字幕翻译页面参数" error={parsed.error} />
    );
  }

  return <AiSubtitleTranslationView {...parsed.data} />;
}

function AiSubtitleTranslationView({
  infoHash,
  fileId,
  fileName,
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

  const records = useTranslationRecords(
    { infoHash, fileId },
    {
      getSubtitleTranslationsUseCase,
      deleteSubtitleTranslationUseCase,
      saveSubtitleTranslationUseCase,
      getSubtitleTranslationByIdUseCase,
    },
  );

  const form = useAiTranslationForm(
    { infoHash, fileId, onTranslateSuccess: records.refetch },
    {
      getSettingsUseCase,
      getVideoMetadataUseCase,
      getSubtitleVttUseCase,
      translateSubtitleUseCase,
    },
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <AiSubtitleHeader fileName={fileName} onBack={() => navigate(-1)} />

      <TranslateForm
        aiConfigs={form.aiConfigs}
        originalTracks={form.originalTracks}
        selectedTrackId={form.selectedTrackId}
        onSelectedTrackChange={form.setSelectedTrackId}
        selectedAiIndex={form.selectedAiIndex}
        onSelectedAiIndexChange={form.setSelectedAiIndex}
        sourceLang={form.sourceLang}
        onSourceLangChange={form.setSourceLang}
        targetLang={form.targetLang}
        onTargetLangChange={form.setTargetLang}
        translateProgress={form.translateProgress}
        translateLoading={form.translateLoading}
        onTranslate={form.handleTranslate}
      />

      <TranslationRecordsSection
        records={records.records}
        loading={records.loading}
        originalTracks={form.originalTracks}
        onRefresh={records.refetch}
        editTargetLang={records.editTargetLang}
        onEditTargetLangChange={records.setEditTargetLang}
        editVttContent={records.editVttContent}
        onEditVttContentChange={records.setEditVttContent}
        saving={records.saving}
        deleteLoading={records.deleteLoading}
        onOpenEdit={records.handleOpenEdit}
        onSaveEdit={records.handleSaveEdit}
        onDownload={records.handleDownload}
        onDelete={records.handleDelete}
      />
    </div>
  );
}

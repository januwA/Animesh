import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { DeleteSubtitleTranslationUseCase } from "@/application/subtitle/DeleteSubtitleTranslationUseCase";
import type { GetSubtitleTranslationByIdUseCase } from "@/application/subtitle/GetSubtitleTranslationByIdUseCase";
import type { GetSubtitleTranslationsUseCase } from "@/application/subtitle/GetSubtitleTranslationsUseCase";
import type { SaveSubtitleTranslationUseCase } from "@/application/subtitle/SaveSubtitleTranslationUseCase";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SubtitleTranslationRecord } from "@/domain/subtitle/SubtitleTranslationSchemas";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";
import { formatError } from "@/utils";

export interface UseTranslationRecordsParams {
  infoHash: NonEmptyString;
  fileId: number;
}

export interface UseTranslationRecordsDeps {
  getSubtitleTranslationsUseCase: Pick<
    GetSubtitleTranslationsUseCase,
    "execute"
  >;
  deleteSubtitleTranslationUseCase: Pick<
    DeleteSubtitleTranslationUseCase,
    "execute"
  >;
  saveSubtitleTranslationUseCase: Pick<
    SaveSubtitleTranslationUseCase,
    "execute"
  >;
  getSubtitleTranslationByIdUseCase: Pick<
    GetSubtitleTranslationByIdUseCase,
    "execute"
  >;
}

export interface UseTranslationRecordsResult {
  records: SubtitleTranslationRecord[];
  loading: boolean;
  deleteLoading: boolean;
  saving: boolean;
  editingRecord: SubtitleTranslationRecord | null;
  editTargetLang: string;
  setEditTargetLang: (value: string) => void;
  editVttContent: string;
  setEditVttContent: (value: string) => void;
  refetch: () => void;
  handleOpenEdit: (record: SubtitleTranslationRecord) => void;
  handleSaveEdit: () => void;
  handleDelete: (recordId: string) => void;
  handleDownload: (record: SubtitleTranslationRecord) => void;
}

export function useTranslationRecords(
  params: UseTranslationRecordsParams,
  deps: UseTranslationRecordsDeps,
): UseTranslationRecordsResult {
  const { infoHash, fileId } = params;
  const {
    getSubtitleTranslationsUseCase,
    deleteSubtitleTranslationUseCase,
    saveSubtitleTranslationUseCase,
    getSubtitleTranslationByIdUseCase,
  } = deps;

  const [editingRecord, setEditingRecord] =
    useState<SubtitleTranslationRecord | null>(null);
  const [editTargetLang, setEditTargetLang] = useState("");
  const [editVttContent, setEditVttContent] = useState("");

  const translationsQuery = useQuery(
    (_ctx) => getSubtitleTranslationsUseCase.execute(infoHash, fileId),
    [infoHash, fileId, getSubtitleTranslationsUseCase],
  );
  const records: SubtitleTranslationRecord[] = translationsQuery.data ?? [];

  const deleteMutation = useMutation<boolean, string>(
    async (_ctx, recordId) =>
      deleteSubtitleTranslationUseCase.execute(recordId),
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

  const handleOpenEdit = useCallback(
    async (record: SubtitleTranslationRecord) => {
      setEditingRecord(record);
      setEditTargetLang(record.target_lang);
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

  const handleSaveEdit = () => {
    saveMutation.execute();
  };

  const handleDelete = (recordId: string) => {
    deleteMutation.execute(recordId);
  };

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

  return {
    records,
    loading: translationsQuery.loading,
    deleteLoading: deleteMutation.loading,
    saving: saveMutation.loading,
    editingRecord,
    editTargetLang,
    setEditTargetLang,
    editVttContent,
    setEditVttContent,
    refetch: translationsQuery.refetch,
    handleOpenEdit,
    handleSaveEdit,
    handleDelete,
    handleDownload,
  };
}

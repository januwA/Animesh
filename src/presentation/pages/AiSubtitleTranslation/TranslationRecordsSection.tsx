import { Languages, Loader2, RefreshCw } from "lucide-react";
import type { SubtitleTranslationRecord } from "@/domain/subtitle/SubtitleTranslationSchemas";
import type { SubtitleTrackInfo } from "@/domain/torrent/TorrentSchemas";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { TranslationRecordCard } from "./TranslationRecordCard";

export interface TranslationRecordsSectionProps {
  records: SubtitleTranslationRecord[];
  loading: boolean;
  originalTracks: SubtitleTrackInfo[];
  onRefresh: () => void;
  editTargetLang: string;
  onEditTargetLangChange: (value: string) => void;
  editVttContent: string;
  onEditVttContentChange: (value: string) => void;
  saving: boolean;
  deleteLoading: boolean;
  onOpenEdit: (record: SubtitleTranslationRecord) => void;
  onSaveEdit: () => void;
  onDownload: (record: SubtitleTranslationRecord) => void;
  onDelete: (recordId: string) => void;
}

export function TranslationRecordsSection({
  records,
  loading,
  originalTracks,
  onRefresh,
  editTargetLang,
  onEditTargetLangChange,
  editVttContent,
  onEditVttContentChange,
  saving,
  deleteLoading,
  onOpenEdit,
  onSaveEdit,
  onDownload,
  onDelete,
}: TranslationRecordsSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">已生成的 AI 字幕翻译记录</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </Button>
      </div>

      {loading && records.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          加载翻译记录中...
        </div>
      ) : records.length === 0 ? (
        <Card className="ani-card">
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
            const originalTrackTitle =
              originalTrack?.title || `轨道 ${record.original_track_id}`;
            return (
              <TranslationRecordCard
                key={record.id}
                record={record}
                originalTrackTitle={originalTrackTitle}
                editTargetLang={editTargetLang}
                onEditTargetLangChange={onEditTargetLangChange}
                editVttContent={editVttContent}
                onEditVttContentChange={onEditVttContentChange}
                saving={saving}
                deleteLoading={deleteLoading}
                onOpenEdit={onOpenEdit}
                onSaveEdit={onSaveEdit}
                onDownload={onDownload}
                onDelete={onDelete}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

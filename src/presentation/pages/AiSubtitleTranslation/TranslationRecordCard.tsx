import { Download, Loader2, Pencil, Trash2 } from "lucide-react";
import type { SubtitleTranslationRecord } from "@/domain/subtitle/SubtitleTranslationSchemas";
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
} from "@/presentation/components/ui/alert-dialog";
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
import { Textarea } from "@/presentation/components/ui/textarea";

export interface TranslationRecordCardProps {
  record: SubtitleTranslationRecord;
  originalTrackTitle: string;
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

export function TranslationRecordCard({
  record,
  originalTrackTitle,
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
}: TranslationRecordCardProps) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">
              AI 翻译 · {originalTrackTitle}
            </span>
            <span className="rounded bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
              {record.target_lang}
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-mono truncate">
            ID: {record.id} · 原始轨道 ID: {record.original_track_id}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenEdit(record)}
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
                    onChange={(e) => onEditTargetLangChange(e.target.value)}
                    placeholder="如 zh / ja / en"
                  />
                </div>

                <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">
                  <Label htmlFor="edit-vtt-content">字幕 VTT 内容</Label>
                  <Textarea
                    id="edit-vtt-content"
                    value={editVttContent}
                    onChange={(e) => onEditVttContentChange(e.target.value)}
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
                <Button onClick={onSaveEdit} disabled={saving}>
                  {saving ? (
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
            onClick={() => onDownload(record)}
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
                disabled={deleteLoading}
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>你绝对确定吗?</AlertDialogTitle>
                <AlertDialogDescription>删除这条资源.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(record.id)}>
                  继续
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

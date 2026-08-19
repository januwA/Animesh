import {
  Download,
  FolderOpen,
  HardDrive,
  Loader2,
  Pause,
  Play,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import { Checkbox } from "@/presentation/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldLabel,
} from "@/presentation/components/ui/field";
import { Progress } from "@/presentation/components/ui/progress";
import { formatBytes, formatLocalDate } from "@/utils";

export interface TorrentCardProps {
  torrent: TorrentStatusInfo;
  onViewFiles: (torrent: TorrentStatusInfo) => void;
  onTogglePause: (torrent: TorrentStatusInfo) => void;
  onDelete: (torrent: TorrentStatusInfo, deleteFiles: boolean) => void;
  delLoading: boolean;
  pendingPauseHash: string | null;
  pendingResumeHash: string | null;
  pendingDeleteHash: string | null;
}

export function TorrentCard({
  torrent,
  onViewFiles,
  onTogglePause,
  onDelete,
  delLoading,
  pendingPauseHash,
  pendingResumeHash,
  pendingDeleteHash,
}: TorrentCardProps) {
  const [deleteFiles, setDeleteFiles] = useState(false);
  const progress = torrent.total_bytes
    ? (torrent.progress_bytes / torrent.total_bytes) * 100
    : 0;

  return (
    <Card className="bg-card hover:bg-muted/30 border-border transition-all duration-300">
      <CardHeader>
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <CardTitle>{torrent.name}</CardTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {torrent.created_at && (
              <span>创建时间: {formatLocalDate(torrent.created_at)}</span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Progress Info */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-start gap-2 text-xs font-medium">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Download className="h-3.5 w-3.5 text-primary" />
              {formatBytes(torrent.download_speed_bytes_per_sec)}/s
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Upload className="h-3.5 w-3.5 text-primary" />
              {formatBytes(torrent.upload_speed_bytes_per_sec)}/s
            </span>
            <span>
              (同伴: {torrent.peers_connected}/{torrent.peers_total})
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Storage Info & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-1 text-xs">
          <div className="flex gap-4 text-muted-foreground items-center">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <HardDrive className="h-3.5 w-3.5 shrink-0" />
              已下载: {formatBytes(torrent.progress_bytes)} / 总大小:{" "}
              {formatBytes(torrent.total_bytes)}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Play / View files */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onViewFiles(torrent)}
              className="h-8 gap-1 text-xs font-medium"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              查看文件
            </Button>

            {/* Pause / Resume */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTogglePause(torrent)}
              className="h-8 w-8 p-0"
              disabled={
                torrent.paused
                  ? torrent.info_hash === pendingResumeHash
                  : torrent.info_hash === pendingPauseHash
              }
              title={torrent.paused ? "开始下载" : "暂停下载"}
            >
              {torrent.paused ? (
                <Play className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Pause className="h-3.5 w-3.5" />
              )}
            </Button>

            {/* Delete */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={torrent.info_hash === pendingDeleteHash}
                  title="删除下载"
                  onClick={() => setDeleteFiles(false)}
                >
                  {torrent.info_hash === pendingDeleteHash ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>删除下载任务</AlertDialogTitle>
                  <AlertDialogDescription>
                    确定要删除种子
                    <span
                      className="font-semibold text-foreground"
                      data-testid="delete-dialog-torrent-name"
                    >
                      {torrent.name}
                    </span>
                    的下载任务吗？
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Field orientation="horizontal">
                  <Checkbox
                    id={`delete-files-${torrent.info_hash}`}
                    checked={deleteFiles}
                    onCheckedChange={(checked) =>
                      setDeleteFiles(checked === true)
                    }
                  />
                  <FieldContent>
                    <FieldLabel
                      htmlFor={`delete-files-${torrent.info_hash}`}
                      className="text-xs font-medium cursor-pointer select-none"
                    >
                      同时删除已下载的本地缓存文件 (彻底释放磁盘空间)
                    </FieldLabel>
                  </FieldContent>
                </Field>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={delLoading}
                    onClick={() => onDelete(torrent, deleteFiles)}
                  >
                    确认删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

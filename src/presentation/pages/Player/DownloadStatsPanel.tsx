import { Download, Upload } from "lucide-react";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { Progress } from "@/presentation/components/ui/progress";
import { formatBytes } from "@/utils";

export interface DownloadStatsPanelProps {
  torrentStatus: TorrentStatusInfo | null;
  downloadProgress: number;
}

export function DownloadStatsPanel({
  torrentStatus,
  downloadProgress,
}: DownloadStatsPanelProps) {
  return (
    <div className="rounded-xl border border-border bg-muted/50 p-4 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2 text-xs sm:text-sm font-medium">
          <span className="flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary animate-pulse" />
            下载进度:{" "}
            {torrentStatus ? `${downloadProgress.toFixed(2)}%` : "计算中..."}
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Card className="ani-card">
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
        <Card className="ani-card">
          <CardContent className="flex flex-col items-center justify-center p-3">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-center">
              总大小
            </span>
            <span className="text-sm font-semibold whitespace-nowrap">
              {torrentStatus ? formatBytes(torrentStatus.total_bytes) : "0 B"}
            </span>
          </CardContent>
        </Card>
        <Card className="ani-card">
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
        <Card className="ani-card">
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
  );
}

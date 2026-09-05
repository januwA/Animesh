import { Download, Loader2, Upload } from "lucide-react";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import { ErrorState } from "@/presentation/components/ErrorState";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import { Checkbox } from "@/presentation/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/presentation/components/ui/item";
import { Progress } from "@/presentation/components/ui/progress";
import { formatBytes } from "@/utils";
import { useTorrentDetailPage } from "./useTorrentDetailPage";

interface TorrentDetailContentProps {
  magnet?: NonEmptyString;
  infoHash?: NonEmptyString;
}

export function TorrentDetailContent({
  magnet,
  infoHash,
}: TorrentDetailContentProps) {
  const {
    torrent,
    loading,
    error,
    refetch,
    selectedIds,
    confirming,
    toggleFile,
    toggleAll,
    confirmSelection,
    handleStartPlayback,
    status,
    downloadProgress,
  } = useTorrentDetailPage({ magnet, infoHash });

  // 仅首次无数据加载时显示整页加载；刷新（已有数据）时保留列表
  if (loading && !torrent) {
    return (
      <Card className="ani-card">
        <CardContent className="flex flex-col items-center justify-center text-center gap-4">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-2" />
          <h2 className="text-xl font-bold">正在启动下载引擎并解析种子...</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            首次连接 Peer 并下载 Metadata 可能需要较长时间，请稍等
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error && !torrent) {
    return (
      <ErrorState title="种子解析失败" message={error} onRetry={refetch} />
    );
  }

  if (!torrent) {
    return (
      <Empty className="py-20">
        <EmptyContent>
          <EmptyTitle>未找到种子数据</EmptyTitle>
          <EmptyDescription>解析未返回结果，请重试或返回</EmptyDescription>
        </EmptyContent>
        <Button variant="outline" onClick={refetch}>
          重试
        </Button>
      </Empty>
    );
  }

  const totalBytes = torrent.files.reduce((sum, f) => sum + f.len, 0);
  const selectedBytes = torrent.files
    .filter((f) => selectedIds.has(f.id))
    .reduce((sum, f) => sum + f.len, 0);
  const selectedCount = selectedIds.size;
  const allSelected =
    torrent.files.length > 0 &&
    torrent.files.every((f) => selectedIds.has(f.id));
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <Card className="ani-card">
      <CardHeader>
        <CardTitle>Hash: {torrent.info_hash}</CardTitle>
        <CardDescription>
          共 {torrent.files.length} 个文件 · {formatBytes(totalBytes)}，已选{" "}
          {selectedCount} 个 · {formatBytes(selectedBytes)}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {status ? (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/50 p-4">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2 text-xs sm:text-sm font-medium">
              <span className="flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5 text-primary animate-pulse" />
                下载进度: {downloadProgress.toFixed(2)}%
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Download className="h-3.5 w-3.5 text-emerald-400" />
                下载: {formatBytes(status.download_speed_bytes_per_sec)}/s
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Upload className="h-3.5 w-3.5 text-info" />
                上传: {formatBytes(status.upload_speed_bytes_per_sec)}/s ( 连接:{" "}
                {status.peers_connected}/{status.peers_total})
              </span>
            </div>
            <Progress value={downloadProgress} className="h-2" />
            <span className="text-xs text-muted-foreground">
              状态: {status.finished ? "已完成" : "正在缓存..."}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            正在解析种子元数据 / 等待任务初始化…
          </div>
        )}

        <div className="flex items-center gap-2">
          <Checkbox
            checked={
              allSelected ? true : someSelected ? "indeterminate" : false
            }
            onCheckedChange={() => toggleAll(torrent.files)}
          />
          <span className="text-sm text-muted-foreground">全选</span>
        </div>

        <ItemGroup>
          {torrent.files.map((file) => (
            <Item variant="outline" key={file.id}>
              <ItemActions>
                <Checkbox
                  checked={selectedIds.has(file.id)}
                  onCheckedChange={() => toggleFile(file.id)}
                />
              </ItemActions>
              <ItemContent>
                <ItemTitle>{file.name}</ItemTitle>
                <ItemDescription>{formatBytes(file.len)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  size="sm"
                  disabled={!selectedIds.has(file.id)}
                  onClick={() =>
                    handleStartPlayback(torrent.info_hash, file.id, file.name)
                  }
                >
                  播放
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>

        <div className="flex justify-end pt-2">
          <Button
            onClick={confirmSelection}
            disabled={confirming || selectedCount === 0}
          >
            {confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            确认选择
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

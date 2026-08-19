import { Film, Loader2 } from "lucide-react";
import type { AddTorrentResult } from "@/domain/torrent/TorrentSchemas";
import { ErrorState } from "@/presentation/components/ErrorState";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { TorrentFileItem } from "./TorrentFileItem";

interface TorrentDetailContentProps {
  torrent: AddTorrentResult | null;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onPlay: (infoHash: string, fileId: number, fileName: string) => void;
}

export function TorrentDetailContent({
  torrent,
  loading,
  error,
  onRetry,
  onPlay,
}: TorrentDetailContentProps) {
  if (loading) {
    return (
      <Card className="py-20">
        <CardContent
          className="flex flex-col items-center justify-center text-center gap-4"
          role="dialog"
        >
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-2" />
          <h2 className="text-xl font-bold">正在启动下载引擎并解析种子...</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            首次连接 Peer 并下载 Metadata 可能需要较长时间，请稍等
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <ErrorState title="种子解析失败" message={error} onRetry={onRetry} />
    );
  }

  if (!torrent) {
    return (
      <Empty className="py-20">
        <EmptyContent>
          <EmptyTitle>未找到种子数据</EmptyTitle>
          <EmptyDescription>解析未返回结果，请重试或返回</EmptyDescription>
        </EmptyContent>
        <Button variant="outline" onClick={onRetry}>
          重试
        </Button>
      </Empty>
    );
  }

  return (
    <Card className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1 flex-1 min-w-0">
          <h2 className="text-lg sm:text-xl font-bold break-all text-foreground">
            {torrent.name}
          </h2>
          <p className="text-xs text-muted-foreground font-mono break-all">
            Hash: {torrent.info_hash}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Film className="h-4 w-4 text-primary" />
            选择要播放的文件：
          </h3>
          <Badge variant="secondary" className="text-xs">
            共 {torrent.files.length} 个文件
          </Badge>
        </div>
        <div className="border border-border rounded-lg bg-muted/30 p-3 flex flex-col gap-2">
          {torrent.files.map((file) => (
            <TorrentFileItem
              key={file.id}
              torrent={torrent}
              file={file}
              onPlay={onPlay}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

import { Loader2 } from "lucide-react";
import type { AddTorrentResult } from "@/domain/torrent/TorrentSchemas";
import { ErrorState } from "@/presentation/components/ErrorState";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
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
  ItemTitle,
} from "@/presentation/components/ui/item";
import { formatBytes } from "@/utils";

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
      <Card className="ani-card">
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
    <Card className="ani-card">
      <CardHeader>
        <CardTitle>Hash: {torrent.info_hash}</CardTitle>
        <CardDescription>共 {torrent.files.length} 个文件</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-2">
          {torrent.files.map((file) => (
            <Item variant="outline" key={file.id}>
              <ItemContent>
                <ItemTitle>{file.name}</ItemTitle>
                <ItemDescription>{formatBytes(file.len)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  size="sm"
                  onClick={() => onPlay(torrent.info_hash, file.id, file.name)}
                >
                  播放
                </Button>
              </ItemActions>
            </Item>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

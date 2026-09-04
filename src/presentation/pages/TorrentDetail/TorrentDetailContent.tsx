import { Loader2 } from "lucide-react";
import type {
  AddTorrentResult,
  FileDetails,
} from "@/domain/torrent/TorrentSchemas";
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
import { formatBytes } from "@/utils";

interface TorrentDetailContentProps {
  torrent: AddTorrentResult | null;
  loading: boolean;
  error: Error | null;
  selectedIds: Set<number>;
  initialized: boolean;
  confirming: boolean;
  onRetry: () => void;
  onPlay: (infoHash: string, fileId: number, fileName: string) => void;
  onToggleFile: (fileId: number) => void;
  onToggleAll: (files: FileDetails[]) => void;
  onConfirmSelection: () => void;
}

export function TorrentDetailContent({
  torrent,
  loading,
  error,
  selectedIds,
  initialized,
  confirming,
  onRetry,
  onPlay,
  onToggleFile,
  onToggleAll,
  onConfirmSelection,
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

  const allSelected =
    initialized && torrent.files.every((f) => selectedIds.has(f.id));
  const selectedCount = initialized ? selectedIds.size : torrent.files.length;

  return (
    <Card className="ani-card">
      <CardHeader>
        <CardTitle>Hash: {torrent.info_hash}</CardTitle>
        <CardDescription>
          共 {torrent.files.length} 个文件，已选 {selectedCount} 个
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={() => onToggleAll(torrent.files)}
          />
          <span className="text-sm text-muted-foreground">全选</span>
        </div>

        <ItemGroup>
          {torrent.files.map((file) => (
            <Item variant="outline" key={file.id}>
              <ItemContent>
                <ItemTitle>{file.name}</ItemTitle>
                <ItemDescription>{formatBytes(file.len)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Checkbox
                  checked={selectedIds.has(file.id)}
                  onCheckedChange={() => onToggleFile(file.id)}
                />
                <Button
                  size="sm"
                  disabled={!selectedIds.has(file.id)}
                  onClick={() => onPlay(torrent.info_hash, file.id, file.name)}
                >
                  播放
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>

        <div className="flex justify-end pt-2">
          <Button
            onClick={onConfirmSelection}
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

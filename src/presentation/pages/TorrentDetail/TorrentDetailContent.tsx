import { Loader2 } from "lucide-react";
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
              <ItemContent>
                <ItemTitle>{file.name}</ItemTitle>
                <ItemDescription>{formatBytes(file.len)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Checkbox
                  checked={selectedIds.has(file.id)}
                  onCheckedChange={() => toggleFile(file.id)}
                />
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

import { ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { Button } from "@/presentation/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { useTorrentStatus } from "@/presentation/context/TorrentStatusContext";
import { DownloadsHeader } from "./DownloadsHeader";
import { GroupPanel } from "./GroupPanel";
import { TorrentCard } from "./TorrentCard";
import { useDownloadsData } from "./useDownloadsData";

export default function Downloads() {
  return <DownloadsView />;
}

function DownloadsView() {
  const { pauseTorrentUseCase, resumeTorrentUseCase, deleteTorrentUseCase } =
    useDI();
  const { torrents, isLoading } = useTorrentStatus();

  const {
    groups,
    unbound,
    delLoading,
    pendingPauseHash,
    pendingResumeHash,
    pendingDeleteHash,
    handleViewFiles,
    handleTogglePause,
    handleDelete,
  } = useDownloadsData(
    { torrents },
    { pauseTorrentUseCase, resumeTorrentUseCase, deleteTorrentUseCase },
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">
          正在加载下载管理器...
        </p>
      </div>
    );
  }

  const renderCard = (torrent: TorrentStatusInfo) => (
    <TorrentCard
      key={torrent.info_hash}
      torrent={torrent}
      onViewFiles={handleViewFiles}
      onTogglePause={handleTogglePause}
      onDelete={handleDelete}
      delLoading={delLoading}
      pendingPauseHash={pendingPauseHash}
      pendingResumeHash={pendingResumeHash}
      pendingDeleteHash={pendingDeleteHash}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <DownloadsHeader total={torrents.length} />

      {torrents.length === 0 ? (
        <Empty>
          <EmptyContent>
            <EmptyTitle>没有正在进行的下载任务</EmptyTitle>
            <EmptyDescription>
              您可以在首页搜索资源，点击"边下边播"或者"复制磁力"解析后开始下载。
            </EmptyDescription>
          </EmptyContent>
          <Button asChild size="sm">
            <Link to="/">前往搜索视频</Link>
          </Button>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Bound subject groups */}
          {groups.map((group) => {
            const hasUnfinished = group.items.some((t) => !t.finished);
            return (
              <GroupPanel
                key={group.subjectId}
                title={group.subjectName}
                items={group.items}
                defaultOpen={hasUnfinished}
                action={
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label="查看条目"
                    title="查看条目"
                    asChild
                  >
                    <Link to={`/subject/${group.subjectId}`}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                }
              >
                {group.items.map(renderCard)}
              </GroupPanel>
            );
          })}

          {/* Unbound group */}
          {unbound.length > 0 && (
            <GroupPanel title="未关联条目" items={unbound} defaultOpen>
              {unbound.map(renderCard)}
            </GroupPanel>
          )}
        </div>
      )}
    </div>
  );
}

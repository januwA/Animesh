import { Download, FolderOpen, Unlink } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { Button } from "@/presentation/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/presentation/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import type { UseSubjectResourcesDeps } from "./useSubjectResources";
import { useSubjectResources } from "./useSubjectResources";

export interface SubjectResourcesTabProps {
  subjectId: number;
  platform: AnimePlatform;
  subjectName: string;
  torrents: TorrentStatusInfo[];
  deps: UseSubjectResourcesDeps;
}

export function SubjectResourcesTab({
  subjectId,
  platform,
  subjectName,
  torrents,
  deps,
}: SubjectResourcesTabProps) {
  const [bindOpen, setBindOpen] = useState(false);

  const r = useSubjectResources(
    { subjectId, platform, torrents, subjectName },
    deps,
  );
  const boundTorrents = r.boundTorrents;
  const unboundTorrents = r.unboundTorrents;
  const bindLoading = r.bindLoading;
  const unbindLoading = r.unbindLoading;

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          已绑定资源
          {boundTorrents.length > 0 && (
            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground/60">
              {boundTorrents.length}
            </span>
          )}
        </h2>
        <Button
          variant="secondary"
          size="sm"
          className="h-8 gap-1.5 text-xs font-medium"
          onClick={() => setBindOpen(true)}
        >
          <Download className="h-3.5 w-3.5" />
          绑定下载
        </Button>
      </div>

      {boundTorrents.length === 0 ? (
        <Empty className="py-8">
          <EmptyContent>
            <EmptyTitle>暂未绑定下载资源</EmptyTitle>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {boundTorrents.map((torrent) => (
            <div
              key={torrent.info_hash}
              className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card transition-colors hover:bg-muted/30"
            >
              <Link
                data-testid="bound-torrent-row"
                className="flex-1 min-w-0 text-left flex items-center gap-3"
                to={`/torrent?infoHash=${torrent.info_hash}&title=${encodeURIComponent(torrent.name)}`}
              >
                <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                <span className="min-w-0 flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {torrent.name}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {torrent.info_hash}
                  </span>
                </span>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive shrink-0"
                disabled={unbindLoading}
                onClick={() => r.handleUnbind(torrent.info_hash)}
              >
                <Unlink className="h-3.5 w-3.5" />
                解绑
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={bindOpen} onOpenChange={setBindOpen}>
        <DialogContent className="sm:max-w-3/5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              绑定下载资源
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              选择要绑定到《{subjectName}
              》的下载任务，一个下载只能属于一个条目。
            </DialogDescription>
          </DialogHeader>

          {unboundTorrents.length === 0 ? (
            <Empty className="py-8">
              <EmptyContent>
                <EmptyTitle>暂无下载任务</EmptyTitle>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="h-72 w-full overflow-y-auto flex flex-col gap-1.5">
              {unboundTorrents.map((torrent) => {
                return (
                  <div
                    key={torrent.info_hash}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-card border border-border"
                  >
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground wrap-break-word">
                        {torrent.name}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {torrent.info_hash}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-xs shrink-0"
                      disabled={bindLoading}
                      onClick={() => r.handleBind(torrent.info_hash)}
                    >
                      绑定
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

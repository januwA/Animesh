import { FileVideo, Play } from "lucide-react";
import type { AddTorrentResult } from "@/domain/torrent/TorrentSchemas";
import { Button } from "@/presentation/components/ui/button";
import { formatBytes } from "@/utils";

interface TorrentFileItemProps {
  torrent: AddTorrentResult;
  file: AddTorrentResult["files"][number];
  onPlay: (infoHash: string, fileId: number, fileName: string) => void;
}

export function TorrentFileItem({
  torrent,
  file,
  onPlay,
}: TorrentFileItemProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg hover:bg-accent border border-transparent hover:border-border transition-all group gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <FileVideo className="h-4 w-4 text-muted-foreground group-hover:text-primary mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-medium text-foreground break-all"
            title={file.name}
          >
            {file.name}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatBytes(file.len)}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => onPlay(torrent.info_hash, file.id, file.name)}
        className="gap-1.5 h-8 shrink-0 w-full sm:w-auto"
      >
        <Play className="h-3.5 w-3.5 fill-current" />
        播放
      </Button>
    </div>
  );
}

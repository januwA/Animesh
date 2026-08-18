import { selectTime } from "@videojs/react";
import { useCallback } from "react";
import { toast } from "sonner";
import type { ChapterInfo } from "@/domain/torrent/TorrentSchemas";
import { formatPlaybackTime } from "@/utils";
import { JsPlayer } from "./player";

export interface ChapterButtonProps {
  chapter: ChapterInfo;
  index: number;
}

export function ChapterButton({ chapter, index }: ChapterButtonProps) {
  const timeState = JsPlayer.usePlayer(selectTime);

  const handleClick = useCallback(() => {
    timeState?.seek(chapter.start_ms / 1000).catch(() => {
      toast.error("跳转到章节失败");
    });
  }, [timeState, chapter.start_ms]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-baseline justify-between gap-3 py-1.5 cursor-pointer hover:bg-secondary/70 px-1 rounded transition-colors text-left"
    >
      <span className="text-sm text-foreground wrap-break-word">
        <span className="text-muted-foreground mr-2">{index + 1}</span>
        {chapter.title}
      </span>
      <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">
        {formatPlaybackTime(chapter.start_ms)}
      </span>
    </button>
  );
}

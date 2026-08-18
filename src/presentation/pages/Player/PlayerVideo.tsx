import { Video, VideoSkin } from "@videojs/react/video";
import { Loader2 } from "lucide-react";
import type { SubtitleSource, SubtitleTrackItem } from "./usePlayerSubtitle";

export interface PlayerVideoProps {
  canPlay: boolean;
  streamUrl: string | null;
  subtitleTracks: SubtitleTrackItem[];
  selectedTrackId: number | string | null;
  subtitleSources: Record<number | string, SubtitleSource>;
}

export function PlayerVideo({
  canPlay,
  streamUrl,
  subtitleTracks,
  selectedTrackId,
  subtitleSources,
}: PlayerVideoProps) {
  if (!canPlay || !streamUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <VideoSkin className="w-full h-full">
      <Video src={streamUrl} playsInline>
        {subtitleTracks
          .filter((t) => t.id === selectedTrackId)
          .map((track) => {
            const url = subtitleSources[track.id]?.url;
            return (
              <track
                key={url ?? track.id}
                id={track.id.toString()}
                kind="subtitles"
                src={url || undefined}
                srcLang={track.language}
                label={track.title || `轨道 ${track.id}`}
                default
              />
            );
          })}
      </Video>
    </VideoSkin>
  );
}

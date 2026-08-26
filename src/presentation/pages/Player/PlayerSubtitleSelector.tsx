import { Loader2 } from "lucide-react";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/presentation/components/ui/native-select";
import type { SubtitleTrackItem } from "./usePlayerSubtitle";

export interface PlayerSubtitleSelectorProps {
  tracks: SubtitleTrackItem[];
  selectedTrackId: number | string | null;
  onChange: (value: string) => void;
  loading: boolean;
}

export function PlayerSubtitleSelector({
  tracks,
  selectedTrackId,
  onChange,
  loading,
}: PlayerSubtitleSelectorProps) {
  if (tracks.length === 0) return null;

  return (
    <>
      <span className="text-xs text-muted-foreground shrink-0">字幕:</span>
      <NativeSelect
        value={selectedTrackId?.toString() ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs"
      >
        <NativeSelectOption value="">关闭字幕</NativeSelectOption>
        {tracks.map((track) => (
          <NativeSelectOption key={track.id} value={track.id.toString()}>
            {track.title || `轨道 ${track.id}`} ({track.language})
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {loading && (
        <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
      )}
    </>
  );
}

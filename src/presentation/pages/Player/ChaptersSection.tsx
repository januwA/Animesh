import { List } from "lucide-react";
import type { VideoMetadata } from "@/domain/torrent/TorrentSchemas";
import { ChapterButton } from "./ChapterButton";
import { CollapsibleSection } from "./CollapsibleSection";

export interface ChaptersSectionProps {
  chapters: VideoMetadata["chapters"];
}

export function ChaptersSection({ chapters }: ChaptersSectionProps) {
  if (chapters.length === 0) return null;

  return (
    <CollapsibleSection
      title="章节"
      icon={<List className="h-4 w-4 text-muted-foreground" />}
      badge={chapters.length}
    >
      <div className="flex flex-col divide-y divide-border">
        {chapters.map((chapter, index) => (
          <ChapterButton
            key={chapter.start_ms}
            chapter={chapter}
            index={index}
          />
        ))}
      </div>
    </CollapsibleSection>
  );
}

import { ChevronDown, Layers } from "lucide-react";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/presentation/components/ui/collapsible";
import { cn } from "@/presentation/lib/utils";
import type { TorrentResultGroup } from "@/presentation/store/searchStore";
import { SearchResultCard } from "./SearchResultCard";

interface SearchResultGroupProps {
  group: TorrentResultGroup;
  open: boolean;
  onOpenChange: () => void;
  onCopyMagnet: (magnet: string) => void;
  onPlay: (magnet: string, title: string) => void;
  showBestAi: boolean;
}

export function SearchResultGroup({
  group,
  open,
  onOpenChange,
  onCopyMagnet,
  onPlay,
  showBestAi,
}: SearchResultGroupProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          data-testid={`group-trigger-${group.name}`}
          className="w-full justify-between gap-2 rounded-xl bg-card/60 border border-border px-3.5 py-2.5 h-auto hover:bg-accent/10 hover:border-muted-foreground/30 transition-all duration-300 cursor-pointer"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground min-w-0">
            <Layers className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{group.name}</span>
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary">{group.items.length} 个</Badge>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-300",
                open && "rotate-180",
              )}
            />
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="grid gap-4">
          {group.items.map((item, innerIndex) => {
            const flatIndex = group.startIndex + innerIndex;
            const isBest =
              showBestAi && flatIndex === 0 && item.ai_score !== undefined;
            return (
              <SearchResultCard
                key={flatIndex.toString()}
                item={item}
                index={flatIndex}
                onCopyMagnet={onCopyMagnet}
                onPlay={onPlay}
                isBestAi={isBest}
              />
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

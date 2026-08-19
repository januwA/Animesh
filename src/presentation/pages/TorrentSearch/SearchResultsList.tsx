import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/presentation/components/ui/button";
import type { TorrentResultGroup } from "@/presentation/store/searchStore";
import { SearchResultGroup } from "./SearchResultGroup";

interface SearchResultsListProps {
  totalCount: number;
  groupCount: number;
  allGroupsCollapsed: boolean;
  onToggleAllGroups: () => void;
  groups: TorrentResultGroup[];
  collapsedGroups: Set<string>;
  onToggleGroup: (name: string) => void;
  onCopyMagnet: (magnet: string) => void;
  onPlay: (magnet: string, title: string) => void;
  showBestAi: boolean;
}

export function SearchResultsList({
  totalCount,
  groupCount,
  allGroupsCollapsed,
  onToggleAllGroups,
  groups,
  collapsedGroups,
  onToggleGroup,
  onCopyMagnet,
  onPlay,
  showBestAi,
}: SearchResultsListProps) {
  return (
    <section className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="results-count text-sm text-muted-foreground">
          找到 <span className="font-semibold text-primary">{totalCount}</span>{" "}
          个资源，共{" "}
          <span className="font-semibold text-primary">{groupCount}</span>{" "}
          个字幕组
        </div>
        <Button
          variant="ghost"
          size="sm"
          data-testid="toggle-all-groups"
          onClick={onToggleAllGroups}
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
          {allGroupsCollapsed ? "全部展开" : "全部折叠"}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <SearchResultGroup
            key={group.name}
            group={group}
            open={!collapsedGroups.has(group.name)}
            onOpenChange={() => onToggleGroup(group.name)}
            onCopyMagnet={onCopyMagnet}
            onPlay={onPlay}
            showBestAi={showBestAi}
          />
        ))}
      </div>
    </section>
  );
}

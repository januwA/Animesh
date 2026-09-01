import { ChevronsUpDown } from "lucide-react";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@/presentation/components/ui/item";
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
  onPlay: (magnet: string) => void;
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
}: SearchResultsListProps) {
  return (
    <section className="w-full flex flex-col gap-4">
      <Item variant="outline">
        <ItemContent>
          <ItemTitle data-testid="search-result-title">
            找到<Badge>{totalCount}</Badge>个资源，共<Badge>{groupCount}</Badge>
            个字幕组
          </ItemTitle>
        </ItemContent>
        <ItemActions>
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
        </ItemActions>
      </Item>

      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <SearchResultGroup
            key={group.name}
            group={group}
            open={!collapsedGroups.has(group.name)}
            onOpenChange={() => onToggleGroup(group.name)}
            onCopyMagnet={onCopyMagnet}
            onPlay={onPlay}
          />
        ))}
      </div>
    </section>
  );
}

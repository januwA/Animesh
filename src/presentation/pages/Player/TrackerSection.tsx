import { Server } from "lucide-react";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/presentation/components/ui/item";
import { CollapsibleSection } from "./CollapsibleSection";

export interface TrackerSectionProps {
  trackers: string[];
}

export function TrackerSection({ trackers }: TrackerSectionProps) {
  return (
    <CollapsibleSection
      title="Tracker 服务器"
      icon={<Server className="h-4 w-4 text-muted-foreground" />}
      badge={trackers.length || undefined}
    >
      {trackers.length > 0 ? (
        <ItemGroup>
          {trackers.map((tracker) => (
            <Item key={tracker} variant="outline" size="sm">
              <ItemContent>
                <ItemTitle className="truncate font-mono">{tracker}</ItemTitle>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <p className="text-xs text-muted-foreground">暂无 Tracker 信息</p>
      )}
    </CollapsibleSection>
  );
}

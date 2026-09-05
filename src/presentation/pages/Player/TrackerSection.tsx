import type { Context } from "ajanuw-context";
import { RefreshCw, Server } from "lucide-react";
import { useDI } from "@/di/DIContext";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import { ErrorState } from "@/presentation/components/ErrorState";
import { Button } from "@/presentation/components/ui/button";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/presentation/components/ui/item";
import { useQuery } from "@/presentation/hooks/useQuery";
import { CollapsibleSection } from "./CollapsibleSection";

export interface TrackerSectionProps {
  infoHash: NonEmptyString;
}

export function TrackerSection({ infoHash }: TrackerSectionProps) {
  const { getTorrentTrackersUseCase } = useDI();
  const torrentTrackersQuery = useQuery(
    (_ctx: Context) => {
      return getTorrentTrackersUseCase.execute(infoHash);
    },
    [getTorrentTrackersUseCase],
  );
  const trackers = torrentTrackersQuery.data || [];
  const isLoading = torrentTrackersQuery.loading;
  const error = torrentTrackersQuery.error;

  return (
    <CollapsibleSection
      title="Tracker 服务器"
      icon={<Server className="h-4 w-4 text-muted-foreground" />}
      badge={trackers.length || undefined}
      action={
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={isLoading}
          onClick={torrentTrackersQuery.refetch}
          aria-label="刷新 Tracker 列表"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      }
    >
      {error ? (
        <ErrorState
          message={"获取Tracker列表数据失败"}
          onRetry={torrentTrackersQuery.refetch}
        />
      ) : trackers.length > 0 ? (
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
        <p className="text-xs text-muted-foreground">
          {isLoading ? "加载中..." : "暂无 Tracker 信息"}
        </p>
      )}
    </CollapsibleSection>
  );
}

import { useMemo } from "react";
import type {
  AnimeCalendarItem,
  NextSeasonMonthGroup,
} from "@/domain/anime/AnimeSchemas";
import { MediaCard } from "@/presentation/components/MediaCard";
import {
  Empty,
  EmptyContent,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/presentation/components/ui/tabs";

interface MonthCalendarProps {
  groups: NextSeasonMonthGroup[];
  activeMonth: number | null;
  onActiveMonthChange: (month: number | null) => void;
  onAnimeClick: (item: AnimeCalendarItem) => void;
}

export function MonthCalendar({
  groups,
  activeMonth,
  onActiveMonthChange,
  onAnimeClick,
}: MonthCalendarProps) {
  const active = activeMonth ?? groups[0]?.month;

  const currentItems = useMemo(() => {
    /* v8 ignore next -- active 始终为 groups 中的有效月份 */
    return groups.find((g) => g.month === active)?.items ?? [];
  }, [groups, active]);

  return (
    <section className="w-full">
      <div className="sticky-safe-top z-10 bg-background/85 backdrop-blur-md pt-2 pb-2 -mx-4 px-4">
        <Tabs
          value={String(active)}
          onValueChange={(v) => onActiveMonthChange(Number(v))}
        >
          <TabsList className="w-full" variant="line">
            {groups.map((group) => (
              <TabsTrigger
                key={group.month}
                value={String(group.month)}
                className="flex-1 relative text-xs"
              >
                {group.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-4"
        style={{ transform: "translate3d(0, 0, 0)" }}
      >
        {currentItems.map((item) => (
          <MediaCard
            key={item.id}
            id={item.id}
            imageSrc={item.image}
            title={item.name}
            rating={item.rating}
            onClick={() => onAnimeClick(item)}
          />
        ))}
      </div>

      {currentItems.length === 0 && (
        <Empty>
          <EmptyContent>
            <EmptyTitle>暂无数据</EmptyTitle>
          </EmptyContent>
        </Empty>
      )}
    </section>
  );
}

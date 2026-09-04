import type { NextSeasonTabItem } from "@/application/anime/GetNextSeasonAnimeUseCase";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { CalendarSkeleton } from "@/presentation/components/CalendarSkeleton";
import { ErrorState } from "@/presentation/components/ErrorState";
import { InfiniteScrollTrigger } from "@/presentation/components/InfiniteScrollTrigger";
import { MediaCard } from "@/presentation/components/MediaCard";
import {
  Empty,
  EmptyContent,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/presentation/components/ui/tabs";

export interface MonthCalendarProps {
  tabs: NextSeasonTabItem[];
  activeMonth: number;
  onActiveMonthChange: (month: number) => void;
  items: AnimeSubject[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onAnimeClick: (item: AnimeSubject) => void;
}

export function MonthCalendar({
  tabs,
  activeMonth,
  onActiveMonthChange,
  items,
  isLoading,
  error,
  onRetry,
  hasMore,
  loadingMore,
  onLoadMore,
  onAnimeClick,
}: MonthCalendarProps) {
  return (
    <section className="w-full flex flex-col">
      <div className="sticky-safe-top z-10 bg-background/85 backdrop-blur-md pt-2 pb-2 -mx-4 px-4">
        <Tabs
          value={String(activeMonth)}
          onValueChange={(v) => onActiveMonthChange(Number(v))}
        >
          <TabsList className="w-full" variant="line">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.month}
                value={String(tab.month)}
                className="flex-1 relative text-xs"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <CalendarSkeleton showWeekDay={false} />
        ) : error ? (
          <ErrorState
            title="获取下季新番失败"
            message={error}
            onRetry={onRetry}
          />
        ) : items.length === 0 ? (
          <Empty>
            <EmptyContent>
              <EmptyTitle>暂无数据</EmptyTitle>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="flex flex-col gap-2">
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
              style={{ transform: "translate3d(0, 0, 0)" }}
            >
              {items.map((item) => (
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
            <InfiniteScrollTrigger
              hasMore={hasMore}
              loading={loadingMore}
              onLoadMore={onLoadMore}
            />
          </div>
        )}
      </div>
    </section>
  );
}

import { useMemo } from "react";
import type {
  AnimeCalendarDay,
  AnimeCalendarItem,
} from "@/domain/anime/AnimeSchemas";
import { MediaCard } from "@/presentation/components/MediaCard";
import {
  Empty,
  EmptyContent,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/presentation/components/ui/tabs";

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function getTodayWeekdayId(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 7 : jsDay;
}

interface WeeklyCalendarProps {
  calendar: AnimeCalendarDay[];
  calendarActiveDay: number | null;
  onActiveDayChange: (dayId: number | null) => void;
  onAnimeClick: (item: AnimeCalendarItem) => void;
}

export function WeeklyCalendar({
  calendar,
  calendarActiveDay,
  onActiveDayChange,
  onAnimeClick,
}: WeeklyCalendarProps) {
  const todayId = useMemo(() => getTodayWeekdayId(), []);

  const activeDay = calendarActiveDay ?? todayId;

  const currentItems = useMemo(() => {
    return calendar.find((day) => day.weekday.id === activeDay)?.items ?? [];
  }, [calendar, activeDay]);

  return (
    <section className="w-full">
      <div className="sticky-safe-top z-10 bg-background/85 backdrop-blur-md pt-2 pb-2 -mx-4 px-4">
        <Tabs
          value={String(activeDay)}
          onValueChange={(v) => onActiveDayChange(Number(v))}
        >
          <TabsList className="w-full" variant="line">
            {WEEKDAY_LABELS.map((label, index) => {
              const dayId = index + 1;
              const isToday = dayId === todayId;
              return (
                <TabsTrigger
                  key={dayId}
                  value={String(dayId)}
                  className="flex-1 relative text-xs"
                >
                  {label}
                  {isToday && dayId !== activeDay && (
                    <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </TabsTrigger>
              );
            })}
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
            <EmptyTitle>暂无更新</EmptyTitle>
          </EmptyContent>
        </Empty>
      )}
    </section>
  );
}

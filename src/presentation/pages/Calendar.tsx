import { Calendar as CalendarIcon, Star, Users } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import type {
  BangumiCalendarDay,
  BangumiCalendarItem,
} from "@/domain/bangumi/BangumiSchemas";
import { ErrorState } from "@/presentation/components/ErrorState";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/presentation/components/ui/tabs";
import { useQuery } from "@/presentation/hooks/useQuery";
import { FavoriteBadge } from "../components/FavoriteBadge";
import { LazyImage } from "../components/LazyImage";
import { useCalendarStore } from "../store/calendarStore";

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function getTodayWeekdayId(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 7 : jsDay;
}

interface WeeklyCalendarProps {
  calendar: BangumiCalendarDay[];
  onAnimeClick: (item: BangumiCalendarItem) => void;
}

function CalendarSkeleton() {
  return (
    <div className="w-full flex flex-col gap-4" data-testid="calendar-skeleton">
      <div className="flex gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <Skeleton key={label} className="h-9 flex-1 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <div
            key={n}
            className="flex flex-col bg-card border border-border rounded-lg overflow-hidden"
          >
            <Skeleton className="aspect-3/4 rounded-none" />
            <div className="p-2 flex flex-col gap-2 flex-1">
              <Skeleton className="h-3.5 w-5/6" />
              <Skeleton className="h-3 w-3/6" />
              <Skeleton className="h-3 w-2/6 mt-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyCalendar({ calendar, onAnimeClick }: WeeklyCalendarProps) {
  const calendarActiveDay = useCalendarStore((s) => s.calendarActiveDay);
  const setCalendarActiveDay = useCalendarStore((s) => s.setCalendarActiveDay);
  const todayId = useMemo(() => getTodayWeekdayId(), []);

  const activeDay = calendarActiveDay ?? todayId;

  const setActiveDay = (dayId: number) => {
    setCalendarActiveDay(dayId);
  };

  // 优化：直接在 7 个元素的 calendar 数组中进行查找，避免 Map 实例的额外创建与开销
  const currentItems = useMemo(() => {
    return calendar.find((day) => day.weekday.id === activeDay)?.items ?? [];
  }, [calendar, activeDay]);

  return (
    <section className="w-full">
      {/* Weekday Tabs */}
      <div className="sticky-safe-top z-10 bg-background/85 backdrop-blur-md pt-2 pb-2 -mx-4 px-4">
        <Tabs
          value={String(activeDay)}
          onValueChange={(v) => setActiveDay(Number(v))}
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

      {/* Anime Grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
        style={{ transform: "translate3d(0, 0, 0)" }}
      >
        {currentItems.map((item) => (
          <AnimeCard
            key={item.id}
            item={item}
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

interface AnimeCardProps {
  item: BangumiCalendarItem;
  onClick: () => void;
}

function AnimeCard({ item, onClick }: AnimeCardProps) {
  const displayName = item.name_cn || item.name;

  return (
    <div className="group flex flex-col bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-all duration-200 text-left relative">
      <FavoriteBadge subjectId={item.id} />
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col flex-1 w-full text-left"
        title={`详情: ${displayName}`}
      >
        {/* Cover Image */}
        {item.images?.large ? (
          <div className="aspect-3/4 w-full overflow-hidden bg-muted">
            <LazyImage
              src={item.images.large}
              alt={displayName}
              style={
                {
                  viewTransitionName: `anime-cover-${item.id}`,
                } as React.CSSProperties
              }
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="aspect-3/4 w-full bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <CalendarIcon className="h-8 w-8 text-primary/30" />
          </div>
        )}

        {/* Info */}
        <div className="p-2 flex flex-col gap-1 flex-1 w-full">
          <h3 className="text-xs font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {displayName}
          </h3>

          <div className="flex items-center gap-2 mt-auto pt-1">
            {item.rating && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                <Star className="h-2.5 w-2.5 fill-current" />
                {item.rating.score.toFixed(1)}
              </span>
            )}
            {item.collection?.doing && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Users className="h-2.5 w-2.5" />
                {item.collection.doing.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}

export default function Calendar() {
  const navigate = useNavigate();
  const { getBangumiCalendarUseCase } = useDI();
  const calendar = useCalendarStore((s) => s.calendar);
  const setCalendar = useCalendarStore((s) => s.setCalendar);

  const {
    loading: isLoading,
    error,
    refetch,
  } = useQuery(
    (ctx) => getBangumiCalendarUseCase.execute(ctx),
    [getBangumiCalendarUseCase, calendar.length, setCalendar],
    {
      enabled: calendar.length === 0,
      onSuccess: (data) => {
        setCalendar(data);
      },
    },
  );

  const handleAnimeClick = useCallback(
    (item: BangumiCalendarItem) => {
      navigate(`/subject/${item.id}`, {
        viewTransition: true,
        state: {
          name: item.name_cn || item.name,
          imageUrl: item.images?.large,
        },
      });
    },
    [navigate],
  );

  return (
    <div className="w-full flex flex-col gap-4">
      {isLoading ? (
        <CalendarSkeleton />
      ) : error ? (
        <ErrorState
          title="获取新番日历失败"
          message={error}
          onRetry={refetch}
        />
      ) : calendar.length === 0 ? (
        <Empty>
          <EmptyContent>
            <EmptyTitle>未找到新番数据</EmptyTitle>
            <EmptyDescription>请稍后重试</EmptyDescription>
          </EmptyContent>
        </Empty>
      ) : (
        <WeeklyCalendar calendar={calendar} onAnimeClick={handleAnimeClick} />
      )}
    </div>
  );
}

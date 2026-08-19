import { useDI } from "@/di/DIContext";
import { ErrorState } from "@/presentation/components/ErrorState";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { CalendarSkeleton } from "./CalendarSkeleton";
import { useCalendarPage } from "./useCalendarPage";
import { WeeklyCalendar } from "./WeeklyCalendar";

export default function Calendar() {
  const { getBangumiCalendarUseCase } = useDI();

  const { calendar, isLoading, error, refetch, handleAnimeClick } =
    useCalendarPage({ getBangumiCalendarUseCase });

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

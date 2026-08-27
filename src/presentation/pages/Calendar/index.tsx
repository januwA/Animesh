import { useDI } from "@/di/DIContext";
import { CalendarSkeleton } from "@/presentation/components/CalendarSkeleton";
import { ErrorState } from "@/presentation/components/ErrorState";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { WeeklyCalendar } from "@/presentation/components/WeeklyCalendar";
import { useCalendarStore } from "../../store/calendarStore";
import { useCalendarPage } from "./useCalendarPage";

export default function Calendar() {
  const { getBangumiCalendarUseCase } = useDI();
  const calendarActiveDay = useCalendarStore((s) => s.calendarActiveDay);
  const setCalendarActiveDay = useCalendarStore((s) => s.setCalendarActiveDay);

  const { calendar, isLoading, error, refetch, handleAnimeClick } =
    useCalendarPage(
      { getCalendarUseCase: getBangumiCalendarUseCase },
      useCalendarStore,
      (id) => `/subject/${id}`,
    );

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-xl font-semibold">新番日历</h1>
      </div>
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
        <WeeklyCalendar
          calendar={calendar}
          calendarActiveDay={calendarActiveDay}
          onActiveDayChange={setCalendarActiveDay}
          onAnimeClick={handleAnimeClick}
        />
      )}
    </div>
  );
}

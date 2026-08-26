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
import { useAnilistCalendarStore } from "../../store/anilistCalendarStore";
import { useAnilistCalendarPage } from "./useAnilistCalendarPage";

export default function AnilistCalendar() {
  const { getAnilistCalendarUseCase } = useDI();
  const calendarActiveDay = useAnilistCalendarStore((s) => s.calendarActiveDay);
  const setCalendarActiveDay = useAnilistCalendarStore(
    (s) => s.setCalendarActiveDay,
  );

  const { calendar, isLoading, error, refetch, handleAnimeClick } =
    useAnilistCalendarPage({ getAnilistCalendarUseCase });

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-xl font-semibold">AniList 周放送</h1>
      </div>
      {isLoading ? (
        <CalendarSkeleton />
      ) : error ? (
        <ErrorState
          title="获取 AniList 数据失败"
          message={error}
          onRetry={refetch}
        />
      ) : calendar.length === 0 ? (
        <Empty>
          <EmptyContent>
            <EmptyTitle>未找到放送数据</EmptyTitle>
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

import { useDI } from "@/di/DIContext";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import { AnimePlatformSchema } from "@/domain/anime/AnimeSchemas";
import { CalendarSkeleton } from "@/presentation/components/CalendarSkeleton";
import { ErrorState } from "@/presentation/components/ErrorState";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { WeeklyCalendar } from "@/presentation/components/WeeklyCalendar";
import { useAnilistCalendarStore } from "@/presentation/store/anilistCalendarStore";
import { useCalendarStore } from "@/presentation/store/calendarStore";
import { useCalendarPage } from "./useCalendarPage";

const platformConfigs = {
  bangumi: {
    title: "新番日历",
    errorTitle: "获取新番日历失败",
    emptyTitle: "未找到新番数据",
    getUseCase: (di: ReturnType<typeof useDI>) => di.getBangumiCalendarUseCase,
    useStore: useCalendarStore,
    subjectPath: (id: number) => `/subject/${id}`,
  },
  anilist: {
    title: "AniList 周放送",
    errorTitle: "获取 AniList 数据失败",
    emptyTitle: "未找到放送数据",
    getUseCase: (di: ReturnType<typeof useDI>) => di.getAnilistCalendarUseCase,
    useStore: useAnilistCalendarStore,
    subjectPath: (id: number) => `/anilist/subject/${id}`,
  },
} as const;

export interface CalendarProps {
  platform?: AnimePlatform;
}

export default function Calendar({ platform = "bangumi" }: CalendarProps) {
  const platformResult = AnimePlatformSchema.safeParse(platform);

  if (!platformResult.success) {
    return (
      <InvalidParamsView title="无效的平台参数" error={platformResult.error} />
    );
  }

  return <CalendarView platform={platformResult.data} />;
}

function CalendarView({ platform }: { platform: AnimePlatform }) {
  const di = useDI();
  const config = platformConfigs[platform];
  const calendarActiveDay = config.useStore((s) => s.calendarActiveDay);
  const setCalendarActiveDay = config.useStore((s) => s.setCalendarActiveDay);

  const { calendar, isLoading, error, refetch, handleAnimeClick } =
    useCalendarPage(
      { getCalendarUseCase: config.getUseCase(di) },
      config.useStore,
      config.subjectPath,
    );

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-xl font-semibold">{config.title}</h1>
      </div>
      {isLoading ? (
        <CalendarSkeleton />
      ) : error ? (
        <ErrorState
          title={config.errorTitle}
          message={error}
          onRetry={refetch}
        />
      ) : calendar.length === 0 ? (
        <Empty>
          <EmptyContent>
            <EmptyTitle>{config.emptyTitle}</EmptyTitle>
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

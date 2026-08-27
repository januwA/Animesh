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
import { useBangumiCalendarStore } from "@/presentation/store/bangumiCalendarStore";
import { useSubjectCalendarPage } from "./useSubjectCalendarPage";

const platformConfigs = {
  bangumi: {
    title: "Bangumi 周放送",
    getUseCase: (di: ReturnType<typeof useDI>) => di.getBangumiCalendarUseCase,
    useStore: useBangumiCalendarStore,
    subjectPath: (id: number) => `/bangumi/subject/${id}`,
  },
  anilist: {
    title: "AniList 周放送",
    getUseCase: (di: ReturnType<typeof useDI>) => di.getAnilistCalendarUseCase,
    useStore: useAnilistCalendarStore,
    subjectPath: (id: number) => `/anilist/subject/${id}`,
  },
} as const;

export interface SubjectCalendarProps {
  platform?: AnimePlatform;
}

export default function SubjectCalendar({
  platform = "bangumi",
}: SubjectCalendarProps) {
  const platformResult = AnimePlatformSchema.safeParse(platform);

  if (!platformResult.success) {
    return (
      <InvalidParamsView title="无效的平台参数" error={platformResult.error} />
    );
  }

  return <SubjectCalendarView platform={platformResult.data} />;
}

function SubjectCalendarView({ platform }: { platform: AnimePlatform }) {
  const di = useDI();
  const config = platformConfigs[platform];
  const calendarActiveDay = config.useStore((s) => s.calendarActiveDay);
  const setCalendarActiveDay = config.useStore((s) => s.setCalendarActiveDay);

  const { calendar, isLoading, error, refetch, handleAnimeClick } =
    useSubjectCalendarPage(
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

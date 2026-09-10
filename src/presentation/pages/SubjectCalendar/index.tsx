import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
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
import { useQuery } from "@/presentation/hooks/useQuery";
import { WeeklyCalendar } from "@/presentation/pages/SubjectCalendar/WeeklyCalendar";

const subjectCalendarParamsSchema = z.object({
  platform: AnimePlatformSchema,
  day: z.preprocess(
    (value) =>
      typeof value === "string" && value !== "" ? Number(value) : undefined,
    z
      .number()
      .int()
      .min(1, "无效的星期参数")
      .max(7, "无效的星期参数")
      .optional(),
  ),
});

const platformConfigs = {
  bangumi: {
    title: "Bangumi 周放送",
    getUseCase: (di: ReturnType<typeof useDI>) => di.getBangumiCalendarUseCase,
  },
  anilist: {
    title: "AniList 周放送",
    getUseCase: (di: ReturnType<typeof useDI>) => di.getAnilistCalendarUseCase,
  },
} as const;

export default function SubjectCalendar() {
  const [searchParams] = useSearchParams();
  const parsed = subjectCalendarParamsSchema.safeParse({
    platform: searchParams.get("platform"),
    day: searchParams.get("day") ?? undefined,
  });

  if (!parsed.success) {
    return <InvalidParamsView title="无效的日历参数" error={parsed.error} />;
  }

  return (
    <SubjectCalendarView
      platform={parsed.data.platform}
      day={parsed.data.day}
    />
  );
}

function SubjectCalendarView({
  platform,
  day,
}: {
  platform: AnimePlatform;
  day?: number;
}) {
  const di = useDI();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const config = platformConfigs[platform];

  const {
    data: calendar,
    loading: isLoading,
    error,
    refetch,
  } = useQuery(
    (ctx) => config.getUseCase(di).execute(ctx),
    [config.getUseCase(di)],
  );

  const handleActiveDayChange = useCallback(
    (dayId: number | null) => {
      const next = new URLSearchParams(searchParams);
      if (dayId === null) {
        next.delete("day");
      } else {
        next.set("day", String(dayId));
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleAnimeClick = useCallback(
    (item: { id: number; name: string; image: string }) => {
      navigate(`/anime/subject/${item.id}?platform=${platform}`, {
        viewTransition: true,
        state: {
          name: item.name,
          imageUrl: item.image,
        },
      });
    },
    [navigate, platform],
  );

  const calendarDays = calendar ?? [];

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
          message={error.message}
          onRetry={refetch}
        />
      ) : calendarDays.length === 0 ? (
        <Empty>
          <EmptyContent>
            <EmptyTitle>未找到新番数据</EmptyTitle>
            <EmptyDescription>请稍后重试</EmptyDescription>
          </EmptyContent>
        </Empty>
      ) : (
        <WeeklyCalendar
          calendar={calendarDays}
          calendarActiveDay={day ?? null}
          onActiveDayChange={handleActiveDayChange}
          onAnimeClick={handleAnimeClick}
        />
      )}
    </div>
  );
}

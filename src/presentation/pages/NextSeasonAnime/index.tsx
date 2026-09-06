import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import { AnimePlatformSchema } from "@/domain/anime/AnimeSchemas";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { MonthCalendar } from "./MonthCalendar";
import { useNextSeasonPage } from "./useNextSeasonPage";

const nextSeasonParamsSchema = z.object({
  platform: AnimePlatformSchema,
  month: z.preprocess(
    (value) =>
      typeof value === "string" && value !== "" ? Number(value) : undefined,
    z
      .number()
      .int()
      .min(1, "无效的月份参数")
      .max(12, "无效的月份参数")
      .optional(),
  ),
});

const platformConfigs = {
  bangumi: {
    getUseCase: (di: ReturnType<typeof useDI>) =>
      di.getBangumiNextSeasonUseCase,
    subjectPath: (id: number) => `/anime/subject/${id}?platform=bangumi`,
  },
  anilist: {
    getUseCase: (di: ReturnType<typeof useDI>) =>
      di.getAnilistNextSeasonUseCase,
    subjectPath: (id: number) => `/anime/subject/${id}?platform=anilist`,
  },
} as const;

export default function NextSeasonAnime() {
  const [searchParams] = useSearchParams();
  const parsed = nextSeasonParamsSchema.safeParse({
    platform: searchParams.get("platform"),
    month: searchParams.get("month") ?? undefined,
  });

  if (!parsed.success) {
    return <InvalidParamsView title="无效的新番参数" error={parsed.error} />;
  }

  return (
    <NextSeasonAnimeView
      platform={parsed.data.platform}
      monthParam={parsed.data.month}
    />
  );
}

function NextSeasonAnimeView({
  platform,
  monthParam,
}: {
  platform: AnimePlatform;
  monthParam?: number;
}) {
  const di = useDI();
  const config = platformConfigs[platform];

  const page = useNextSeasonPage(
    { getNextSeasonUseCase: config.getUseCase(di) },
    config.subjectPath,
    monthParam,
  );

  return (
    <div className="w-full flex flex-col gap-4">
      <MonthCalendar
        tabs={page.tabs}
        activeMonth={page.activeMonth}
        onActiveMonthChange={page.setActiveMonth}
        items={page.items}
        isLoading={page.isLoading}
        error={page.error}
        onRetry={page.refetch}
        hasMore={page.hasMore}
        loadingMore={page.loadingMore}
        onLoadMore={page.loadMore}
        onAnimeClick={page.handleAnimeClick}
      />
    </div>
  );
}

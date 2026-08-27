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
import { useAnilistNextSeasonStore } from "@/presentation/store/anilistNextSeasonStore";
import { useNextSeasonStore } from "@/presentation/store/nextSeasonStore";
import { MonthCalendar } from "./MonthCalendar";
import { useNextSeasonPage } from "./useNextSeasonPage";

const platformConfigs = {
  bangumi: {
    title: "下季新番",
    errorTitle: "获取下季新番失败",
    getUseCase: (di: ReturnType<typeof useDI>) =>
      di.getBangumiNextSeasonUseCase,
    useStore: useNextSeasonStore,
    subjectPath: (id: number) => `/subject/${id}`,
  },
  anilist: {
    title: "AniList 下季新番",
    errorTitle: "获取 AniList 下季新番失败",
    getUseCase: (di: ReturnType<typeof useDI>) =>
      di.getAnilistNextSeasonUseCase,
    useStore: useAnilistNextSeasonStore,
    subjectPath: (id: number) => `/anilist/subject/${id}`,
  },
} as const;

export interface NextSeasonAnimeProps {
  platform?: AnimePlatform;
}

export default function NextSeasonAnime({
  platform = "bangumi",
}: NextSeasonAnimeProps) {
  const platformResult = AnimePlatformSchema.safeParse(platform);

  if (!platformResult.success) {
    return (
      <InvalidParamsView title="无效的平台参数" error={platformResult.error} />
    );
  }

  return <NextSeasonAnimeView platform={platformResult.data} />;
}

function NextSeasonAnimeView({ platform }: { platform: AnimePlatform }) {
  const di = useDI();
  const config = platformConfigs[platform];
  const activeMonth = config.useStore((s) => s.activeMonth);
  const setActiveMonth = config.useStore((s) => s.setActiveMonth);

  const { data, isLoading, error, refetch, handleAnimeClick } =
    useNextSeasonPage(
      { getNextSeasonUseCase: config.getUseCase(di) },
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
      ) : data.length === 0 ? (
        <Empty>
          <EmptyContent>
            <EmptyTitle>未找到下季新番数据</EmptyTitle>
            <EmptyDescription>请稍后重试</EmptyDescription>
          </EmptyContent>
        </Empty>
      ) : (
        <MonthCalendar
          groups={data}
          activeMonth={activeMonth}
          onActiveMonthChange={setActiveMonth}
          onAnimeClick={handleAnimeClick}
        />
      )}
    </div>
  );
}

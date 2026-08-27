import { useDI } from "@/di/DIContext";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import { AnimePlatformSchema } from "@/domain/anime/AnimeSchemas";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { useAnilistNextSeasonStore } from "@/presentation/store/anilistNextSeasonStore";
import { useNextSeasonStore } from "@/presentation/store/nextSeasonStore";
import { MonthCalendar } from "./MonthCalendar";
import { useNextSeasonPage } from "./useNextSeasonPage";

const platformConfigs = {
  bangumi: {
    title: "下季新番",
    getUseCase: (di: ReturnType<typeof useDI>) =>
      di.getBangumiNextSeasonUseCase,
    useStore: useNextSeasonStore,
    subjectPath: (id: number) => `/bangumi/subject/${id}`,
  },
  anilist: {
    title: "AniList 下季新番",
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

  const page = useNextSeasonPage(
    { getNextSeasonUseCase: config.getUseCase(di) },
    config.useStore,
    config.subjectPath,
  );

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-xl font-semibold">{config.title}</h1>
      </div>
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

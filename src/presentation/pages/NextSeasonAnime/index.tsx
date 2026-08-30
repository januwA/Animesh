import { useSearchParams } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import { AnimePlatformSchema } from "@/domain/anime/AnimeSchemas";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import {
  useAnilistNextSeasonStore,
  useBangumiNextSeasonStore,
} from "@/presentation/store/nextSeasonStore";
import { MonthCalendar } from "./MonthCalendar";
import { useNextSeasonPage } from "./useNextSeasonPage";

const platformConfigs = {
  bangumi: {
    getUseCase: (di: ReturnType<typeof useDI>) =>
      di.getBangumiNextSeasonUseCase,
    useStore: useBangumiNextSeasonStore,
    subjectPath: (id: number) => `/anime/subject/${id}?platform=bangumi`,
  },
  anilist: {
    getUseCase: (di: ReturnType<typeof useDI>) =>
      di.getAnilistNextSeasonUseCase,
    useStore: useAnilistNextSeasonStore,
    subjectPath: (id: number) => `/anime/subject/${id}?platform=anilist`,
  },
} as const;

export default function NextSeasonAnime() {
  const [searchParams] = useSearchParams();
  const platformResult = AnimePlatformSchema.safeParse(
    searchParams.get("platform"),
  );

  if (!platformResult.success) {
    return (
      <InvalidParamsView
        title="缺少 platform 参数"
        error={platformResult.error}
      />
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

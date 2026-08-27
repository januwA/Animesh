import { useDI } from "@/di/DIContext";
import { CalendarSkeleton } from "@/presentation/components/CalendarSkeleton";
import { ErrorState } from "@/presentation/components/ErrorState";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { useAnilistNextSeasonStore } from "../../store/anilistNextSeasonStore";
import { MonthCalendar } from "../NextSeasonAnime/MonthCalendar";
import { useNextSeasonPage } from "../NextSeasonAnime/useNextSeasonPage";

export default function AnilistNextSeason() {
  const { getAnilistNextSeasonUseCase } = useDI();
  const activeMonth = useAnilistNextSeasonStore((s) => s.activeMonth);
  const setActiveMonth = useAnilistNextSeasonStore((s) => s.setActiveMonth);

  const { data, isLoading, error, refetch, handleAnimeClick } =
    useNextSeasonPage(
      { getNextSeasonUseCase: getAnilistNextSeasonUseCase },
      useAnilistNextSeasonStore,
      (id) => `/anilist/subject/${id}`,
    );

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-xl font-semibold">AniList 下季新番</h1>
      </div>
      {isLoading ? (
        <CalendarSkeleton />
      ) : error ? (
        <ErrorState
          title="获取 AniList 下季新番失败"
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

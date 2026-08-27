import { useDI } from "@/di/DIContext";
import { CalendarSkeleton } from "@/presentation/components/CalendarSkeleton";
import { ErrorState } from "@/presentation/components/ErrorState";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { useNextSeasonStore } from "../../store/nextSeasonStore";
import { MonthCalendar } from "./MonthCalendar";
import { useNextSeasonPage } from "./useNextSeasonPage";

export default function NextSeasonAnime() {
  const { getBangumiNextSeasonUseCase } = useDI();
  const activeMonth = useNextSeasonStore((s) => s.activeMonth);
  const setActiveMonth = useNextSeasonStore((s) => s.setActiveMonth);

  const { data, isLoading, error, refetch, handleAnimeClick } =
    useNextSeasonPage(
      { getNextSeasonUseCase: getBangumiNextSeasonUseCase },
      useNextSeasonStore,
      (id) => `/subject/${id}`,
    );

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-xl font-semibold">下季新番</h1>
      </div>
      {isLoading ? (
        <CalendarSkeleton />
      ) : error ? (
        <ErrorState
          title="获取下季新番失败"
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

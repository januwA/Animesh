import { useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type {
  GetNextSeasonAnimeUseCase,
  NextSeasonTabItem,
} from "@/application/anime/GetNextSeasonAnimeUseCase";
import { getNextSeasonInfo } from "@/application/anime/GetNextSeasonAnimeUseCase";
import type { NextSeasonSubjectsPage } from "@/domain/anime/AnimeRepository";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";
import type { NextSeasonStoreState } from "@/presentation/store/nextSeasonStore";

const PAGE_LIMIT = 20;

export interface UseNextSeasonPageDeps {
  getNextSeasonUseCase: Pick<GetNextSeasonAnimeUseCase, "execute">;
}

export function useNextSeasonPage(
  deps: UseNextSeasonPageDeps,
  useDataStore: <U>(selector: (state: NextSeasonStoreState) => U) => U,
  subjectPath: (id: number) => string,
) {
  const { getNextSeasonUseCase } = deps;
  const navigate = useNavigate();
  const seasonInfo = useMemo(() => getNextSeasonInfo(new Date()), []);

  const storedActiveMonth = useDataStore((s) => s.activeMonth);
  const setActiveMonthStore = useDataStore((s) => s.setActiveMonth);
  const monthsData = useDataStore((s) => s.monthsData);
  const setMonthData = useDataStore((s) => s.setMonthData);
  const appendMonthItems = useDataStore((s) => s.appendMonthItems);

  const activeMonth = storedActiveMonth ?? seasonInfo.months[0];
  const currentMonthData = monthsData[activeMonth];
  const items = currentMonthData?.items ?? [];
  const hasNextPage = currentMonthData?.hasNextPage ?? false;
  const isInitialized = currentMonthData !== undefined;

  const {
    loading: isInitialLoading,
    error: queryError,
    refetch,
  } = useQuery(
    (ctx) => {
      return getNextSeasonUseCase.execute(ctx, {
        year: seasonInfo.year,
        month: activeMonth,
        limit: PAGE_LIMIT,
        offset: 0,
      });
    },
    [seasonInfo.year, activeMonth],
    {
      enabled: !isInitialized,
      onSuccess: (page) => {
        setMonthData(activeMonth, {
          items: page.items,
          hasNextPage: page.hasNextPage,
          exhausted: page.items.length === 0,
        });
      },
    },
  );

  const loadMoreMutation = useMutation<
    NextSeasonSubjectsPage,
    { year: number; month: number; offset: number }
  >(
    (ctx, { year, month, offset }) =>
      getNextSeasonUseCase.execute(ctx, {
        year,
        month,
        limit: PAGE_LIMIT,
        offset,
      }),
    {
      onSuccess: (page, params) => {
        appendMonthItems(params.month, page.items, page.hasNextPage);
      },
    },
  );

  const hasMore = isInitialized && !currentMonthData.exhausted && hasNextPage;
  const storeRef = useRef({ activeMonth: storedActiveMonth, monthsData });
  storeRef.current = { activeMonth: storedActiveMonth, monthsData };

  const firstMonth = seasonInfo.months[0];

  const loadMore = useCallback(() => {
    // v8 ignore next
    if (isInitialLoading) return;
    const { activeMonth: month, monthsData: data } = storeRef.current;
    const resolvedMonth = month ?? firstMonth;
    const monthData = data[resolvedMonth];
    if (!monthData?.hasNextPage || monthData.exhausted) return;
    loadMoreMutation.execute({
      year: seasonInfo.year,
      month: resolvedMonth,
      offset: monthData.items.length,
    });
  }, [isInitialLoading, loadMoreMutation.execute, seasonInfo.year, firstMonth]);

  const handleActiveMonthChange = useCallback(
    (month: number) => {
      setActiveMonthStore(month);
    },
    [setActiveMonthStore],
  );

  const handleAnimeClick = useCallback(
    (item: AnimeSubject) => {
      navigate(subjectPath(item.id), {
        viewTransition: true,
        state: {
          name: item.name,
          imageUrl: item.image,
        },
      });
    },
    [navigate, subjectPath],
  );

  const isLoading = !isInitialized && isInitialLoading;
  const error = queryError ? queryError.message : null;

  return {
    tabs: seasonInfo.tabs as NextSeasonTabItem[],
    activeMonth,
    setActiveMonth: handleActiveMonthChange,
    items,
    hasNextPage,
    isLoading,
    error,
    refetch,
    hasMore,
    loadingMore: loadMoreMutation.loading,
    loadMore,
    handleAnimeClick,
  };
}

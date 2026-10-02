import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type {
  GetNextSeasonAnimeUseCase,
  NextSeasonTabItem,
} from "@/application/anime/GetNextSeasonAnimeUseCase";
import { getNextSeasonInfo } from "@/application/anime/GetNextSeasonAnimeUseCase";
import type { NextSeasonSubjectsPage } from "@/domain/anime/AnimeRepository";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import {
  getNextPageOffset,
  useInfiniteQuery,
} from "@/presentation/hooks/useInfiniteQuery";

const PAGE_LIMIT = 20;

export interface UseNextSeasonPageDeps {
  getNextSeasonUseCase: Pick<GetNextSeasonAnimeUseCase, "execute">;
}

/**
 * 月份数据由基础设施层 @Cached（1 天 TTL）缓存，此处不重复缓存。
 * 使用 useInfiniteQuery 管理分页，activeMonth 持久化在 URL ?month= 参数中。
 */
export function useNextSeasonPage(
  deps: UseNextSeasonPageDeps,
  subjectPath: (id: number) => string,
  monthParam?: number,
) {
  const { getNextSeasonUseCase } = deps;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const seasonInfo = useMemo(() => getNextSeasonInfo(new Date()), []);

  const resolveMonth = useCallback(
    (month: number | undefined) => {
      if (month && seasonInfo.months.includes(month)) return month;
      return seasonInfo.months[0];
    },
    [seasonInfo],
  );

  const [activeMonth, setActiveMonthState] = useState(() =>
    resolveMonth(monthParam),
  );

  useEffect(() => {
    setActiveMonthState(resolveMonth(monthParam));
  }, [monthParam, resolveMonth]);

  const {
    items: rawItems,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    error: queryError,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery<NextSeasonSubjectsPage, { year: number; month: number }>(
    {
      queryKey: [seasonInfo.year, activeMonth],
      queryFn: (ctx, params, pageParam) =>
        getNextSeasonUseCase.execute(ctx, {
          year: params.year,
          month: params.month,
          limit: PAGE_LIMIT,
          offset: pageParam,
        }),
      getItems: (page) => page.items,
      getNextPageParam: (lastPage, allPages) => {
        if (!lastPage.hasNextPage) return undefined;
        return getNextPageOffset(allPages, (p) => p.items);
      },
      params: { year: seasonInfo.year, month: activeMonth },
    },
  );

  const items = useMemo(() => {
    const typedItems = rawItems as AnimeSubject[];
    const seen = new Set<number>();
    return typedItems.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [rawItems]);

  const handleActiveMonthChange = useCallback(
    (month: number) => {
      setActiveMonthState(month);
      if (searchParams.get("month") !== String(month)) {
        const next = new URLSearchParams(searchParams);
        next.set("month", String(month));
        setSearchParams(next, { replace: true });
      }
    },
    [searchParams, setSearchParams],
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

  const isLoading = isFetching && items.length === 0;
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
    hasMore: hasNextPage,
    loadingMore: isFetchingNextPage,
    loadMore: fetchNextPage,
    handleAnimeClick,
  };
}

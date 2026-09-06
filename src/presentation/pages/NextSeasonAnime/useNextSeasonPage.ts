import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type {
  GetNextSeasonAnimeUseCase,
  NextSeasonTabItem,
} from "@/application/anime/GetNextSeasonAnimeUseCase";
import { getNextSeasonInfo } from "@/application/anime/GetNextSeasonAnimeUseCase";
import type { NextSeasonSubjectsPage } from "@/domain/anime/AnimeRepository";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";

const PAGE_LIMIT = 20;

export interface UseNextSeasonPageDeps {
  getNextSeasonUseCase: Pick<GetNextSeasonAnimeUseCase, "execute">;
}

export interface NextSeasonMonthData {
  items: AnimeSubject[];
  hasNextPage: boolean;
  /** 后端已无更多数据（当前页返回空数组时置 true） */
  exhausted: boolean;
}

/**
 * 月份数据由基础设施层 @Cached（1 天 TTL）缓存，此处不重复缓存，
 * monthsData 保存在本地 state（挂载期间跨月份切换保留），
 * activeMonth 持久化在 URL ?month= 参数中。
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

  const [monthsData, setMonthsData] = useState<
    Record<number, NextSeasonMonthData>
  >({});

  const setMonthData = useCallback(
    (month: number, data: NextSeasonMonthData) => {
      setMonthsData((prev) => ({ ...prev, [month]: data }));
    },
    [],
  );

  const appendMonthItems = useCallback(
    (month: number, newItems: AnimeSubject[], hasNextPage: boolean) => {
      setMonthsData((prev) => {
        // appendMonthItems 仅由 loadMore 触发，对应月份已完成首次加载，无需空值兜底
        const current = prev[month];
        // 按 id 去重，避免 AniList 分页重复返回同一条目
        const existingIds = new Set(current.items.map((it) => it.id));
        const uniqueNew = newItems.filter((it) => !existingIds.has(it.id));
        return {
          ...prev,
          [month]: {
            ...current,
            items: [...current.items, ...uniqueNew],
            hasNextPage,
            // 当本页返回空数组时，说明后端已无更多数据
            exhausted: current.exhausted || newItems.length === 0,
          },
        };
      });
    },
    [],
  );

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
  const storeRef = useRef({ activeMonth, monthsData });
  storeRef.current = { activeMonth, monthsData };

  const loadMore = useCallback(() => {
    // v8 ignore next
    if (isInitialLoading) return;
    const { activeMonth: month, monthsData: data } = storeRef.current;
    const monthData = data[month];
    if (!monthData?.hasNextPage || monthData.exhausted) return;
    loadMoreMutation.execute({
      year: seasonInfo.year,
      month,
      offset: monthData.items.length,
    });
  }, [isInitialLoading, loadMoreMutation.execute, seasonInfo.year]);

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

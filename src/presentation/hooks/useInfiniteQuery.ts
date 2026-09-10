import type { CancelFunc, Context } from "ajanuw-context";
import {
  Background,
  Canceled,
  WithCancel,
  WithTimeout,
  WithValue,
} from "ajanuw-context";
import type { Duration } from "ajanuw-duration";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TRACE_ID } from "@/domain/common/ContextKeys";

export interface UseInfiniteQueryOptions<TPage, TParams> {
  /** 查询键，变化时自动重置分页并重新获取首页 */
  queryKey: unknown[];
  /** 获取单页数据的函数，pageParam 由 getNextPageParam 提供 */
  queryFn: (ctx: Context, params: TParams, pageParam: number) => Promise<TPage>;
  /** 从单页数据中提取 items 数组 */
  getItems: (page: TPage) => unknown[];
  /** 根据最后一页计算下一页的 pageParam，返回 undefined 表示无更多数据 */
  getNextPageParam: (lastPage: TPage, allPages: TPage[]) => number | undefined;
  /** 首页的 pageParam，默认 0 */
  initialPageParam?: number;
  /** 调用方的自定义参数，透传给 queryFn */
  params: TParams;
  /** 是否启用，默认 true */
  enabled?: boolean;
  /** 请求超时时间 */
  timeout?: Duration;
}

export interface UseInfiniteQueryResult<TPage> {
  /** 所有页数据 [page0, page1, ...] */
  pages: TPage[];
  /** 所有页 items 扁平化后的数组 */
  items: unknown[];
  /** 是否正在获取首页（queryKey 变化后的首次加载） */
  isFetching: boolean;
  /** 是否正在加载下一页 */
  isFetchingNextPage: boolean;
  /** 是否还有更多数据 */
  hasNextPage: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 加载下一页 */
  fetchNextPage: () => void;
  /** 重新获取（从首页开始） */
  refetch: () => void;
}

function createCtx(timeout?: Duration): [Context, CancelFunc] {
  const [rawCtx, cancel] = timeout
    ? WithTimeout(Background, timeout.inMilliseconds)
    : WithCancel(Background);
  return [WithValue(rawCtx, TRACE_ID, crypto.randomUUID()), cancel];
}

/**
 * 分页查询 hook，支持首页自动获取与手动加载更多。
 *
 * queryKey 变化时自动重置分页并重新获取首页；
 * fetchNextPage 加载下一页并追加到 pages；
 * 组件卸载时自动取消所有进行中的请求。
 */
export function useInfiniteQuery<TPage, TParams = void>(
  options: UseInfiniteQueryOptions<TPage, TParams>,
): UseInfiniteQueryResult<TPage> {
  const {
    queryKey,
    queryFn,
    getItems,
    getNextPageParam,
    initialPageParam = 0,
    params,
    enabled = true,
    timeout,
  } = options;

  const [pages, setPages] = useState<TPage[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCancelRef = useRef<CancelFunc | null>(null);
  const loadMoreCancelRef = useRef<CancelFunc | null>(null);
  const queryFnRef = useRef(queryFn);
  const getNextPageParamRef = useRef(getNextPageParam);
  const getItemsRef = useRef(getItems);
  const paramsRef = useRef(params);
  const optionsRef = useRef(options);
  queryFnRef.current = queryFn;
  getNextPageParamRef.current = getNextPageParam;
  getItemsRef.current = getItems;
  paramsRef.current = params;
  optionsRef.current = options;

  const cancelAll = useCallback(() => {
    fetchCancelRef.current?.();
    fetchCancelRef.current = null;
    loadMoreCancelRef.current?.();
    loadMoreCancelRef.current = null;
  }, []);

  const fetchFirstPage = useCallback(() => {
    cancelAll();
    setPages([]);
    setIsFetching(true);
    setIsFetchingNextPage(false);
    setError(null);
    setHasNextPage(false);

    const [ctx, cancel] = createCtx(timeout);
    fetchCancelRef.current = cancel;

    queryFnRef.current(ctx, paramsRef.current, initialPageParam).then(
      (firstPage) => {
        if (ctx.err() === Canceled) return;
        fetchCancelRef.current = null;
        setPages([firstPage]);
        setIsFetching(false);
        setHasNextPage(
          getNextPageParamRef.current(firstPage, [firstPage]) !== undefined,
        );
      },
      (err: unknown) => {
        if (ctx.err() === Canceled) return;
        fetchCancelRef.current = null;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsFetching(false);
      },
    );
  }, [cancelAll, initialPageParam, timeout]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey 变化时重置
  useEffect(() => {
    if (enabled) fetchFirstPage();
    else {
      setIsFetching(false);
      setPages([]);
      setHasNextPage(false);
    }
    return cancelAll;
  }, [enabled, ...queryKey]);

  const fetchNextPage = useCallback(() => {
    if (isFetchingNextPage || !hasNextPage) return;

    const lastPage = pages[pages.length - 1];
    const pageParam = getNextPageParamRef.current(lastPage, pages);
    // v8 ignore next -- 防御性检查：hasNextPage 由 getNextPageParam 派生，正常流程不会到达
    if (pageParam === undefined) return;

    setIsFetchingNextPage(true);
    setError(null);

    const [ctx, cancel] = createCtx(timeout);
    loadMoreCancelRef.current = cancel;

    queryFnRef.current(ctx, paramsRef.current, pageParam).then(
      (nextPage) => {
        if (ctx.err() === Canceled) return;
        loadMoreCancelRef.current = null;
        setPages((prev) => {
          const updated = [...prev, nextPage];
          setHasNextPage(
            getNextPageParamRef.current(nextPage, updated) !== undefined,
          );
          return updated;
        });
        setIsFetchingNextPage(false);
      },
      (err: unknown) => {
        if (ctx.err() === Canceled) return;
        loadMoreCancelRef.current = null;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsFetchingNextPage(false);
      },
    );
  }, [isFetchingNextPage, hasNextPage, pages, timeout]);

  const refetch = useCallback(() => {
    fetchFirstPage();
  }, [fetchFirstPage]);

  const items = useMemo(
    () => pages.flatMap((page) => getItemsRef.current(page)),
    [pages],
  );

  return {
    pages,
    items,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    error,
    fetchNextPage,
    refetch,
  };
}

/**
 * 计算所有已加载页的累计偏移量（即 items 总数），
 * 用于 getNextPageParam 中确定下一次请求的 pageParam。
 *
 * @example
 * getNextPageParam: (lastPage, allPages) => {
 *   const offset = getNextPageOffset(allPages, getItems);
 *   return offset < lastPage.total ? offset : undefined;
 * },
 */
export function getNextPageOffset<TPage>(
  allPages: TPage[],
  getItems: (page: TPage) => unknown[],
): number {
  return allPages.reduce((sum, page) => sum + getItems(page).length, 0);
}

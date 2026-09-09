import type { SubmitEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { SearchAnimeSubjectsUseCase } from "@/application/anime/SearchAnimeSubjectsUseCase";
import type {
  AnimeSubject,
  AnimeSubjectSearchResult,
} from "@/domain/anime/AnimeSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import { useMutation } from "@/presentation/hooks/useMutation";

const SEARCH_LIMIT = 20;

export interface UseSubjectSearchPageDeps {
  searchSubjectsUseCase: Pick<SearchAnimeSubjectsUseCase, "execute">;
}

/**
 * 搜索结果由基础设施层 @Cached（12 小时 TTL）缓存，此处不重复缓存，
 * 搜索状态保存在本地 state，关键词持久化在 URL ?keyword= 参数中，
 * 重新挂载（如从详情页返回）时通过参数自动重新搜索恢复结果。
 */
export function useSubjectSearchPage(
  keywordParam: string | undefined,
  deps: UseSubjectSearchPageDeps,
  subjectPath: (id: number) => string,
) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { searchSubjectsUseCase } = deps;

  const [keyword, setKeyword] = useState(keywordParam ?? "");
  const [searchedKeyword, setSearchedKeyword] = useState("");
  const [results, setResults] = useState<AnimeSubject[]>([]);
  const [total, setTotal] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  const searchMutation = useMutation<
    AnimeSubjectSearchResult,
    { queryText: string }
  >(
    (ctx, { queryText }) =>
      searchSubjectsUseCase.execute(ctx, {
        keyword: NonEmptyStringSchema.parse(queryText),
        limit: SEARCH_LIMIT,
        offset: 0,
      }),
    {
      onSuccess: (data) => {
        setResults(data.items);
        setTotal(data.total);
      },
      onError: () => {
        setResults([]);
        setTotal(0);
      },
    },
  );

  const loadMoreMutation = useMutation<
    AnimeSubject[],
    { queryText: string; offset: number }
  >(
    (ctx, { queryText, offset }) =>
      searchSubjectsUseCase
        .execute(ctx, {
          keyword: NonEmptyStringSchema.parse(queryText),
          limit: SEARCH_LIMIT,
          offset,
        })
        .then((page) => page.items),
    {
      onSuccess: (data, params) => {
        /* v8 ignore next -- 竞态防护：正常流程中 performSearch 总会先 cancel 该 mutation，此分支不可达 */
        if (params.queryText !== searchedKeyword) return;
        setResults((prev) => [...prev, ...data]);
      },
    },
  );

  const hasMore = results.length < total;

  const performSearch = useCallback(
    (queryText: string) => {
      setKeyword(queryText);
      setSearchedKeyword(queryText);
      setHasSearched(true);
      loadMoreMutation.cancel();
      searchMutation.execute({ queryText });

      if (searchParams.get("keyword") !== queryText) {
        const next = new URLSearchParams(searchParams);
        next.set("keyword", queryText);
        setSearchParams(next);
      }
    },
    [
      loadMoreMutation.cancel,
      searchMutation.execute,
      searchParams,
      setSearchParams,
    ],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: 仅在 URL 关键词变化时自动触发搜索，searchedKeyword 是防重复搜索的守卫条件
  useEffect(() => {
    if (keywordParam && keywordParam !== searchedKeyword) {
      performSearch(keywordParam);
    }
  }, [keywordParam]);

  const handleSearch = (e: SubmitEvent) => {
    e.preventDefault();
    performSearch(keyword.trim());
  };

  const loadMore = useCallback(() => {
    if (loadMoreMutation.loading || !hasMore || !searchedKeyword) return;
    loadMoreMutation.execute({
      queryText: searchedKeyword,
      offset: results.length,
    });
  }, [
    loadMoreMutation.loading,
    hasMore,
    searchedKeyword,
    results.length,
    loadMoreMutation.execute,
  ]);

  const handleSubjectClick = useCallback(
    (item: AnimeSubject) => {
      navigate(subjectPath(item.id), {
        viewTransition: true,
        state: { name: item.name, imageUrl: item.image },
      });
    },
    [navigate, subjectPath],
  );

  return {
    search: {
      keyword,
      setKeyword,
      handleSearch,
      performSearch,
    },
    results: {
      items: results,
      handleSubjectClick,
      onLoadMore: loadMore,
    },
    status: {
      loading: searchMutation.loading,
      error: searchMutation.error,
      hasSearched,
      hasMore,
      loadingMore: loadMoreMutation.loading,
      handleCancel: searchMutation.cancel,
    },
  };
}

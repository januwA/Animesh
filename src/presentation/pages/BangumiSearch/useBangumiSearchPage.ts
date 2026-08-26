import type { SubmitEvent } from "react";
import { useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { SearchAnimeSubjectsUseCase } from "@/application/anime/SearchAnimeSubjectsUseCase";
import type {
  AnimeSubject,
  AnimeSubjectSearchResult,
} from "@/domain/anime/AnimeSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useBangumiSearchStore } from "@/presentation/store/bangumiSearchStore";

const SEARCH_LIMIT = 20;

/** useBangumiSearchPage 的依赖，由调用方（页面组合根）注入 */
export interface UseBangumiSearchPageDeps {
  searchBangumiSubjectsUseCase: Pick<SearchAnimeSubjectsUseCase, "execute">;
}

export function useBangumiSearchPage(
  keywordParam: string | undefined,
  deps: UseBangumiSearchPageDeps,
) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { searchBangumiSubjectsUseCase } = deps;

  const keyword = useBangumiSearchStore((s) => s.keyword);
  const setKeyword = useBangumiSearchStore((s) => s.setKeyword);
  const results = useBangumiSearchStore((s) => s.results);
  const setResults = useBangumiSearchStore((s) => s.setResults);
  const appendResults = useBangumiSearchStore((s) => s.appendResults);
  const total = useBangumiSearchStore((s) => s.total);
  const setTotal = useBangumiSearchStore((s) => s.setTotal);
  const hasSearched = useBangumiSearchStore((s) => s.hasSearched);
  const setHasSearched = useBangumiSearchStore((s) => s.setHasSearched);
  const searchedKeyword = useBangumiSearchStore((s) => s.searchedKeyword);
  const setSearchedKeyword = useBangumiSearchStore((s) => s.setSearchedKeyword);

  const searchMutation = useMutation<
    AnimeSubjectSearchResult,
    { queryText: string }
  >(
    (ctx, { queryText }) =>
      searchBangumiSubjectsUseCase.execute(ctx, {
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
      searchBangumiSubjectsUseCase
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
        appendResults(data);
      },
    },
  );

  const hasMore = results.length < total;

  const performSearch = useCallback(
    (queryText: string) => {
      setSearchedKeyword(queryText);
      setHasSearched(true);
      loadMoreMutation.cancel();
      searchMutation.execute({ queryText });
    },
    [
      setSearchedKeyword,
      setHasSearched,
      loadMoreMutation.cancel,
      searchMutation.execute,
    ],
  );

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

  useEffect(() => {
    if (keywordParam) {
      setKeyword(keywordParam);
      setSearchParams({}, { replace: true });
      performSearch(keywordParam);
    }
  }, [keywordParam, setSearchParams, performSearch, setKeyword]);

  const handleSearch = (e: SubmitEvent) => {
    e.preventDefault();
    performSearch(keyword.trim());
  };

  const handleSubjectClick = useCallback(
    (item: AnimeSubject) => {
      navigate(`/subject/${item.id}`, {
        viewTransition: true,
        state: { name: item.name, imageUrl: item.image },
      });
    },
    [navigate],
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

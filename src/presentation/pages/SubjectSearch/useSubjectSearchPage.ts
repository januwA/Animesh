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

const SEARCH_LIMIT = 20;

interface SearchStoreState {
  keyword: string;
  searchedKeyword: string;
  results: AnimeSubject[];
  total: number;
  hasSearched: boolean;
  setKeyword: (val: string) => void;
  setSearchedKeyword: (val: string) => void;
  setResults: (val: AnimeSubject[]) => void;
  appendResults: (val: AnimeSubject[]) => void;
  setTotal: (val: number) => void;
  setHasSearched: (val: boolean) => void;
}

export interface UseSubjectSearchPageDeps {
  searchSubjectsUseCase: Pick<SearchAnimeSubjectsUseCase, "execute">;
}

export function useSubjectSearchPage(
  keywordParam: string | undefined,
  deps: UseSubjectSearchPageDeps,
  useSearchStore: <U>(selector: (state: SearchStoreState) => U) => U,
  subjectPath: (id: number) => string,
) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { searchSubjectsUseCase } = deps;

  const keyword = useSearchStore((s) => s.keyword);
  const setKeyword = useSearchStore((s) => s.setKeyword);
  const results = useSearchStore((s) => s.results);
  const setResults = useSearchStore((s) => s.setResults);
  const appendResults = useSearchStore((s) => s.appendResults);
  const total = useSearchStore((s) => s.total);
  const setTotal = useSearchStore((s) => s.setTotal);
  const hasSearched = useSearchStore((s) => s.hasSearched);
  const setHasSearched = useSearchStore((s) => s.setHasSearched);
  const searchedKeyword = useSearchStore((s) => s.searchedKeyword);
  const setSearchedKeyword = useSearchStore((s) => s.setSearchedKeyword);

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

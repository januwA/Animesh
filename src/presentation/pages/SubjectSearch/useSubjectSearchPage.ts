import type { SubmitEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { SearchAnimeSubjectsUseCase } from "@/application/anime/SearchAnimeSubjectsUseCase";
import type {
  AnimeSubject,
  AnimeSubjectSearchResult,
} from "@/domain/anime/AnimeSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import {
  getNextPageOffset,
  useInfiniteQuery,
} from "@/presentation/hooks/useInfiniteQuery";

const SEARCH_LIMIT = 20;

export interface UseSubjectSearchPageDeps {
  searchSubjectsUseCase: Pick<SearchAnimeSubjectsUseCase, "execute">;
}

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
  const [hasSearched, setHasSearched] = useState(false);

  const {
    items: results,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    error,
    fetchNextPage,
  } = useInfiniteQuery<AnimeSubjectSearchResult, { queryText: string }>({
    queryKey: [searchedKeyword],
    enabled: searchedKeyword !== "",
    queryFn: (ctx, { queryText }, pageParam) =>
      searchSubjectsUseCase.execute(ctx, {
        keyword: NonEmptyStringSchema.parse(queryText),
        limit: SEARCH_LIMIT,
        offset: pageParam,
      }),
    getItems: (page) => page.items,
    getNextPageParam: (lastPage, allPages) => {
      const offset = getNextPageOffset(allPages, (p) => p.items);
      return offset < lastPage.total ? offset : undefined;
    },
    params: { queryText: searchedKeyword },
  });

  const performSearch = useCallback(
    (queryText: string) => {
      setKeyword(queryText);
      setSearchedKeyword(queryText);
      setHasSearched(true);

      if (searchParams.get("keyword") !== queryText) {
        const next = new URLSearchParams(searchParams);
        next.set("keyword", queryText);
        setSearchParams(next);
      }
    },
    [searchParams, setSearchParams],
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
    if (isFetchingNextPage || !hasNextPage || !searchedKeyword) return;
    fetchNextPage();
  }, [isFetchingNextPage, hasNextPage, searchedKeyword, fetchNextPage]);

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
      items: results as AnimeSubject[],
      handleSubjectClick,
      onLoadMore: loadMore,
    },
    status: {
      loading: isFetching,
      error: error?.message ?? null,
      hasSearched,
      hasMore: hasNextPage,
      loadingMore: isFetchingNextPage,
    },
  };
}

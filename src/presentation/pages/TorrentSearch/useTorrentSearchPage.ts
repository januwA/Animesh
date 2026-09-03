import { zodResolver } from "@hookform/resolvers/zod";
import { Duration } from "ajanuw-duration";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import type { SearchTorrentsUseCase } from "@/application/torrent/SearchTorrentsUseCase";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import {
  TORRENT_SEARCH_ENGINES,
  type TorrentSearchEngine,
} from "@/domain/torrent/TorrentEngines";
import type { SearchResultItem } from "@/domain/torrent/TorrentSchemas";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useSearchHistoryStore } from "@/presentation/store/searchHistoryStore";
import {
  groupTorrentResults,
  useSearchStore,
} from "@/presentation/store/searchStore";
import { filterResults } from "./useSearchFilter";

export interface TorrentSearchFormValues {
  keyword: string;
  searchEngines: TorrentSearchEngine[];
}

const torrentSearchFormSchema = z.object({
  keyword: z.string().trim().min(1, "请输入搜索关键词"),
  searchEngines: z
    .array(z.enum(TORRENT_SEARCH_ENGINES))
    .min(1, "请选择至少一个搜索引擎"),
});

/** useTorrentSearchPage 的依赖，由调用方（页面组合根）注入 */
export interface UseTorrentSearchPageDeps {
  searchTorrentsUseCase: Pick<SearchTorrentsUseCase, "execute">;
}

async function searchMultipleEngines(
  searchTorrentsUseCase: Pick<SearchTorrentsUseCase, "execute">,
  ctx: Parameters<SearchTorrentsUseCase["execute"]>[0],
  keyword: string,
  engines: TorrentSearchEngine[],
): Promise<SearchResultItem[]> {
  const results = await Promise.allSettled(
    engines.map((engine) =>
      searchTorrentsUseCase.execute(ctx, {
        keyword: NonEmptyStringSchema.parse(keyword),
        engine,
      }),
    ),
  );

  const merged: SearchResultItem[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const item of result.value) {
        const key = String(item.link);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      }
    }
  }

  const allFailed = results.every((r) => r.status === "rejected");
  if (allFailed && results.length > 0) {
    const firstError = results[0] as PromiseRejectedResult;
    throw firstError.reason;
  }

  return merged;
}

export function useTorrentSearchPage(
  keywordParam: string | undefined,
  deps: UseTorrentSearchPageDeps,
) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { searchTorrentsUseCase } = deps;

  const searchResults = useSearchStore((s) => s.searchResults);
  const setSearchResults = useSearchStore((s) => s.setSearchResults);
  const filter = useSearchStore((s) => s.filter);
  const setFilter = useSearchStore((s) => s.setFilter);

  const history = useSearchHistoryStore((s) => s.history);
  const addHistory = useSearchHistoryStore((s) => s.addHistory);
  const deleteHistory = useSearchHistoryStore((s) => s.deleteHistory);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);

  const searchMutation = useMutation<
    SearchResultItem[],
    { queryText: string; engines: TorrentSearchEngine[] }
  >(
    (ctx, params) =>
      searchMultipleEngines(
        searchTorrentsUseCase,
        ctx,
        params.queryText,
        params.engines,
      ),
    {
      timeout: new Duration({ seconds: 15 }),
      onSuccess: (data) => setSearchResults(data),
      onError: () => setSearchResults([]),
    },
  );

  const collapsedGroups = useSearchStore((s) => s.collapsedGroups);
  const toggleGroup = useSearchStore((s) => s.toggleGroup);
  const collapseAllGroups = useSearchStore((s) => s.collapseAllGroups);
  const expandAllGroups = useSearchStore((s) => s.expandAllGroups);

  const filteredResults = useMemo(
    () => filterResults(searchResults, filter),
    [searchResults, filter],
  );

  const groups = useMemo(
    () => groupTorrentResults(filteredResults || []),
    [filteredResults],
  );

  const prevResultsRef = useRef(searchResults);
  useEffect(() => {
    if (prevResultsRef.current !== searchResults) {
      prevResultsRef.current = searchResults;
      expandAllGroups();
    }
  }, [searchResults, expandAllGroups]);

  const allGroupsCollapsed =
    groups.length > 0 && collapsedGroups.size === groups.length;
  const groupNames = groups.map((g) => g.name);

  const form = useForm<TorrentSearchFormValues>({
    resolver: zodResolver(torrentSearchFormSchema),
    defaultValues: {
      keyword: "",
      searchEngines: ["anibt"],
    },
  });

  const performSearch = useCallback(
    (queryText: string, engines: TorrentSearchEngine[]) => {
      addHistory(queryText);

      searchMutation.execute({ queryText, engines });
    },
    [searchMutation.execute, addHistory],
  );

  const setSearchKeywordField = useCallback(
    (val: string) => {
      form.setValue("keyword", val);
    },
    [form],
  );

  useEffect(() => {
    if (keywordParam) {
      setSearchKeywordField(keywordParam);
      setSearchParams({}, { replace: true });
      performSearch(keywordParam, form.getValues("searchEngines"));
    }
  }, [
    keywordParam,
    setSearchParams,
    performSearch,
    setSearchKeywordField,
    form.getValues,
  ]);

  const handleSearch = (e: React.SubmitEvent) => {
    e.preventDefault();
    const keyword = form.getValues("keyword").trim();
    const engines = form.getValues("searchEngines");
    performSearch(keyword, engines);
  };

  const handleDeleteHistory = (item: string) => {
    deleteHistory(item);
  };

  const handleClearHistory = () => {
    clearHistory();
  };

  const handleCopyMagnet = async (magnet: string) => {
    try {
      await navigator.clipboard.writeText(magnet);
      toast.success("磁力链接已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  const handlePlay = (magnet: string) => {
    navigate(`/torrent?magnet=${encodeURIComponent(magnet)}`);
  };

  const handleToggleAllGroups = () => {
    if (allGroupsCollapsed) {
      expandAllGroups();
    } else {
      collapseAllGroups(groupNames);
    }
  };

  return {
    search: {
      form,
      handleSearch,
      performSearch,
      searchKeyword: form.watch("keyword"),
      setSearchKeyword: setSearchKeywordField,
      searchEngines: form.watch("searchEngines"),
    },
    searchHistory: {
      history,
      handleDeleteHistory,
      handleClearHistory,
    },
    filter: {
      setFilter,
    },
    results: {
      searchResults: filteredResults,
      groups,
      collapsedGroups,
      toggleGroup,
      allGroupsCollapsed,
      handleToggleAllGroups,
      handleCopyMagnet,
      handlePlay,
    },
    status: {
      loading: searchMutation.loading,
      error: searchMutation.error,
      handleCancel: searchMutation.cancel,
    },
  };
}

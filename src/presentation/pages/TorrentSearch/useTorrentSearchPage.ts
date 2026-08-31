import { zodResolver } from "@hookform/resolvers/zod";
import { Duration } from "ajanuw-duration";
import { useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import type { GetSettingsUseCase } from "@/application/settings/GetSettingsUseCase";
import type { SearchTorrentsUseCase } from "@/application/torrent/SearchTorrentsUseCase";
import type { SearchTorrentsWithAiUseCase } from "@/application/torrent/SearchTorrentsWithAiUseCase";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import {
  TORRENT_SEARCH_ENGINES,
  type TorrentSearchEngine,
} from "@/domain/torrent/TorrentEngines";
import type { AiSearchResultItem } from "@/domain/torrent/TorrentSchemas";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";
import { useSearchHistoryStore } from "@/presentation/store/searchHistoryStore";
import { useSearchStore } from "@/presentation/store/searchStore";

export interface TorrentSearchFormValues {
  keyword: string;
  searchEngine: TorrentSearchEngine;
  aiAlias: string;
}

const torrentSearchFormSchema = z.object({
  keyword: z.string().trim().min(1, "请输入搜索关键词"),
  searchEngine: z.enum(TORRENT_SEARCH_ENGINES),
  aiAlias: z.string(),
});

/** useTorrentSearchPage 的依赖，由调用方（页面组合根）注入 */
export interface UseTorrentSearchPageDeps {
  searchTorrentsUseCase: Pick<SearchTorrentsUseCase, "execute">;
  searchTorrentsWithAiUseCase: Pick<SearchTorrentsWithAiUseCase, "execute">;
  getSettingsUseCase: Pick<GetSettingsUseCase, "execute">;
}

export function useTorrentSearchPage(
  keywordParam: string | undefined,
  deps: UseTorrentSearchPageDeps,
) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const {
    searchTorrentsUseCase,
    searchTorrentsWithAiUseCase,
    getSettingsUseCase,
  } = deps;

  const searchResults = useSearchStore((s) => s.searchResults);
  const setSearchResults = useSearchStore((s) => s.setSearchResults);
  const searchHasSearched = useSearchStore((s) => s.searchHasSearched);
  const setSearchHasSearched = useSearchStore((s) => s.setSearchHasSearched);

  const history = useSearchHistoryStore((s) => s.history);
  const addHistory = useSearchHistoryStore((s) => s.addHistory);
  const deleteHistory = useSearchHistoryStore((s) => s.deleteHistory);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);

  const aiQuery = useQuery(
    () => getSettingsUseCase.execute(),
    [getSettingsUseCase],
  );
  const aiConfigs = aiQuery.data?.ai_configs ?? [];

  const searchMutation = useMutation<
    AiSearchResultItem[],
    { queryText: string; engine: TorrentSearchEngine; aiAlias: string }
  >(
    (ctx, params) => {
      const dto = {
        keyword: NonEmptyStringSchema.parse(params.queryText),
        engine: params.engine,
      };
      return params.aiAlias !== "none"
        ? searchTorrentsWithAiUseCase.execute(ctx, {
            ...dto,
            aiAlias: NonEmptyStringSchema.parse(params.aiAlias),
          })
        : searchTorrentsUseCase.execute(ctx, dto);
    },
    {
      timeout: new Duration({ seconds: 15 }),
      onSuccess: (data) => setSearchResults(data),
      onError: () => setSearchResults([]),
    },
  );

  const groups = useSearchStore((s) => s.groups);
  const collapsedGroups = useSearchStore((s) => s.collapsedGroups);
  const toggleGroup = useSearchStore((s) => s.toggleGroup);
  const collapseAllGroups = useSearchStore((s) => s.collapseAllGroups);
  const expandAllGroups = useSearchStore((s) => s.expandAllGroups);

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
      searchEngine: "anibt",
      aiAlias: "none",
    },
  });

  const performSearch = useCallback(
    (queryText: string, engine: TorrentSearchEngine) => {
      setSearchHasSearched(true);
      addHistory(queryText);

      searchMutation.execute({
        queryText,
        engine,
        aiAlias: form.getValues("aiAlias"),
      });
    },
    [form, searchMutation.execute, setSearchHasSearched, addHistory],
  );

  const setSearchKeywordField = useCallback(
    (val: string) => {
      form.setValue("keyword", val);
    },
    [form],
  );

  const setSearchEngineField = (val: TorrentSearchEngine) => {
    form.setValue("searchEngine", val);
  };

  useEffect(() => {
    if (keywordParam) {
      setSearchKeywordField(keywordParam);
      setSearchParams({}, { replace: true });
      performSearch(keywordParam, form.getValues("searchEngine"));
    }
  }, [
    keywordParam,
    setSearchParams,
    performSearch,
    setSearchKeywordField,
    form.getValues,
  ]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const keyword = form.getValues("keyword").trim();
    const engine = form.getValues("searchEngine");
    performSearch(keyword, engine);
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
      searchEngine: form.watch("searchEngine"),
      setSearchEngine: setSearchEngineField,
    },
    ai: {
      aiConfigs,
      selectedAiAlias: form.watch("aiAlias"),
    },
    searchHistory: {
      history,
      handleDeleteHistory,
      handleClearHistory,
    },
    results: {
      searchResults,
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
      searchHasSearched,
      handleCancel: searchMutation.cancel,
    },
  };
}

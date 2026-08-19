import type { SubmitEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import type { GetSettingsUseCase } from "@/application/settings/GetSettingsUseCase";
import type { SearchTorrentsUseCase } from "@/application/torrent/SearchTorrentsUseCase";
import type { SearchTorrentsWithAiUseCase } from "@/application/torrent/SearchTorrentsWithAiUseCase";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentSearchEngine } from "@/domain/torrent/TorrentEngines";
import type { AiSearchResultItem } from "@/domain/torrent/TorrentSchemas";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";
import { useSearchStore } from "@/presentation/store/searchStore";

const SELECTED_AI_ALIAS_KEY = "animesh_selected_ai_alias";
const SEARCH_HISTORY_KEY = "animesh_search_history";

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

  const searchKeyword = useSearchStore((s) => s.searchKeyword);
  const setSearchKeyword = useSearchStore((s) => s.setSearchKeyword);
  const searchEngine = useSearchStore((s) => s.searchEngine);
  const setSearchEngine = useSearchStore((s) => s.setSearchEngine);
  const searchResults = useSearchStore((s) => s.searchResults);
  const setSearchResults = useSearchStore((s) => s.setSearchResults);
  const searchHasSearched = useSearchStore((s) => s.searchHasSearched);
  const setSearchHasSearched = useSearchStore((s) => s.setSearchHasSearched);

  const [selectedAiAlias, setSelectedAiAlias] = useState<string>(
    () => localStorage.getItem(SELECTED_AI_ALIAS_KEY) || "none",
  );

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
      onSuccess: (data) => setSearchResults(data),
      onError: () => setSearchResults([]),
    },
  );

  const [history, setHistory] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const groups = useSearchStore((s) => s.groups);
  const collapsedGroups = useSearchStore((s) => s.collapsedGroups);
  const toggleGroup = useSearchStore((s) => s.toggleGroup);
  const collapseAllGroups = useSearchStore((s) => s.collapseAllGroups);
  const expandAllGroups = useSearchStore((s) => s.expandAllGroups);

  // 仅当搜索结果集合变化（新一次搜索）时重置为全部展开
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

  const performSearch = useCallback(
    (queryText: string) => {
      setSearchHasSearched(true);

      setHistory((prev) => {
        const filtered = prev.filter((item) => item !== queryText);
        const nextHistory = [queryText, ...filtered];
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(nextHistory));
        return nextHistory;
      });

      searchMutation.execute({
        queryText,
        engine: searchEngine,
        aiAlias: selectedAiAlias,
      });
    },
    [
      searchEngine,
      selectedAiAlias,
      searchMutation.execute,
      setSearchHasSearched,
    ],
  );

  useEffect(() => {
    if (keywordParam) {
      setSearchKeyword(keywordParam);
      setSearchParams({}, { replace: true });
      performSearch(keywordParam);
    }
  }, [keywordParam, setSearchParams, performSearch, setSearchKeyword]);

  const handleSearch = (e: SubmitEvent) => {
    e.preventDefault();
    performSearch(searchKeyword.trim());
  };

  const handleDeleteHistory = (item: string) => {
    setHistory((prev) => {
      const nextHistory = prev.filter((x) => x !== item);
      if (nextHistory.length === 0) {
        localStorage.removeItem(SEARCH_HISTORY_KEY);
      } else {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(nextHistory));
      }
      return nextHistory;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  };

  const handleCopyMagnet = async (magnet: string) => {
    try {
      await navigator.clipboard.writeText(magnet);
      toast.success("磁力链接已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  const handlePlay = (magnet: string, title: string) => {
    navigate(
      `/torrent?magnet=${encodeURIComponent(magnet)}&title=${encodeURIComponent(title)}`,
    );
  };

  const handleSelectAiAlias = (alias: string) => {
    setSelectedAiAlias(alias);
    localStorage.setItem(SELECTED_AI_ALIAS_KEY, alias);
  };

  const handleToggleAllGroups = () => {
    if (allGroupsCollapsed) {
      expandAllGroups();
    } else {
      collapseAllGroups(groupNames);
    }
  };

  return {
    searchKeyword,
    setSearchKeyword,
    searchEngine,
    setSearchEngine,
    loading: searchMutation.loading,
    error: searchMutation.error,
    searchResults,
    searchHasSearched,
    aiConfigs,
    selectedAiAlias,
    history,
    groups,
    collapsedGroups,
    toggleGroup,
    allGroupsCollapsed,
    handleToggleAllGroups,
    handleSearch,
    handleDeleteHistory,
    handleClearHistory,
    handleCopyMagnet,
    handlePlay,
    handleSelectAiAlias,
    handleCancel: searchMutation.cancel,
    performSearch,
  };
}

import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import { ErrorState } from "@/presentation/components/ErrorState";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { AiFilterBar } from "./AiFilterBar";
import { AiSearchLoading } from "./AiSearchLoading";
import { SearchForm } from "./SearchForm";
import { SearchHistory } from "./SearchHistory";
import { SearchLoading } from "./SearchLoading";
import { SearchResultsList } from "./SearchResultsList";
import { useTorrentSearchPage } from "./useTorrentSearchPage";
import { WelcomeGuide } from "./WelcomeGuide";

const torrentSearchParamsSchema = z.object({
  keyword: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
});

export default function TorrentSearch() {
  const [searchParams] = useSearchParams();

  const parsed = torrentSearchParamsSchema.safeParse({
    keyword: searchParams.get("keyword") ?? undefined,
  });
  if (!parsed.success) {
    return <InvalidParamsView title="无效的搜索参数" error={parsed.error} />;
  }

  return <TorrentSearchView keyword={parsed.data.keyword} />;
}

function TorrentSearchView({ keyword }: { keyword: string | undefined }) {
  const {
    searchTorrentsUseCase,
    searchTorrentsWithAiUseCase,
    getSettingsUseCase,
  } = useDI();

  const page = useTorrentSearchPage(keyword, {
    searchTorrentsUseCase,
    searchTorrentsWithAiUseCase,
    getSettingsUseCase,
  });

  return (
    <>
      <SearchForm
        keyword={page.searchKeyword}
        setKeyword={page.setSearchKeyword}
        loading={page.loading}
        onSubmit={page.handleSearch}
        searchEngine={page.searchEngine}
        setSearchEngine={page.setSearchEngine}
      />

      {page.aiConfigs.length > 0 && (
        <AiFilterBar
          aiConfigs={page.aiConfigs}
          selectedAiAlias={page.selectedAiAlias}
          disabled={page.loading}
          onSelect={page.handleSelectAiAlias}
        />
      )}

      <SearchHistory
        history={page.history}
        onSelectKeyword={page.setSearchKeyword}
        onDelete={page.handleDeleteHistory}
        onClear={page.handleClearHistory}
      />

      {page.loading &&
        (page.selectedAiAlias !== "none" ? (
          <AiSearchLoading onCancel={page.handleCancel} />
        ) : (
          <SearchLoading onCancel={page.handleCancel} />
        ))}

      {page.error && (
        <ErrorState
          message={page.error}
          title="搜索失败"
          onRetry={() => page.performSearch(page.searchKeyword)}
        />
      )}

      {!page.loading &&
        !page.error &&
        (page.searchHasSearched && page.searchResults.length === 0 ? (
          <Empty>
            <EmptyContent>
              <EmptyTitle>未找到相关资源</EmptyTitle>
              <EmptyDescription>请换个关键词试试</EmptyDescription>
            </EmptyContent>
          </Empty>
        ) : !page.searchHasSearched ? (
          <WelcomeGuide />
        ) : null)}

      {!page.loading && !page.error && page.searchResults.length > 0 && (
        <SearchResultsList
          totalCount={page.searchResults.length}
          groupCount={page.groups.length}
          allGroupsCollapsed={page.allGroupsCollapsed}
          onToggleAllGroups={page.handleToggleAllGroups}
          groups={page.groups}
          collapsedGroups={page.collapsedGroups}
          onToggleGroup={page.toggleGroup}
          onCopyMagnet={page.handleCopyMagnet}
          onPlay={page.handlePlay}
          showBestAi={page.selectedAiAlias !== "none"}
        />
      )}
    </>
  );
}

import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import { ErrorState } from "@/presentation/components/ErrorState";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { Card, CardContent } from "@/presentation/components/ui/card";
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
    <div className="flex flex-col gap-6">
      <SearchForm
        keyword={page.search.searchKeyword}
        setKeyword={page.search.setSearchKeyword}
        loading={page.status.loading}
        onSubmit={page.search.handleSearch}
        searchEngine={page.search.searchEngine}
        setSearchEngine={page.search.setSearchEngine}
      />

      {page.ai.aiConfigs.length > 0 && (
        <AiFilterBar
          aiConfigs={page.ai.aiConfigs}
          selectedAiAlias={page.ai.selectedAiAlias}
          disabled={page.status.loading}
          onSelect={page.ai.handleSelectAiAlias}
        />
      )}

      <SearchHistory
        history={page.searchHistory.history}
        onSelectKeyword={page.search.setSearchKeyword}
        onDelete={page.searchHistory.handleDeleteHistory}
        onClear={page.searchHistory.handleClearHistory}
      />

      {page.status.loading &&
        (page.ai.selectedAiAlias !== "none" ? (
          <AiSearchLoading onCancel={page.status.handleCancel} />
        ) : (
          <SearchLoading onCancel={page.status.handleCancel} />
        ))}

      {page.status.error && (
        <ErrorState
          message={page.status.error}
          title="搜索失败"
          onRetry={() => page.search.performSearch(page.search.searchKeyword)}
        />
      )}

      {!page.status.loading &&
        !page.status.error &&
        (page.status.searchHasSearched &&
        page.results.searchResults.length === 0 ? (
          <Card className="ani-card">
            <CardContent>
              <Empty>
                <EmptyContent>
                  <EmptyTitle>未找到相关资源</EmptyTitle>
                  <EmptyDescription>请换个关键词试试</EmptyDescription>
                </EmptyContent>
              </Empty>
            </CardContent>
          </Card>
        ) : !page.status.searchHasSearched ? (
          <WelcomeGuide />
        ) : null)}

      {!page.status.loading &&
        !page.status.error &&
        page.results.searchResults.length > 0 && (
          <SearchResultsList
            totalCount={page.results.searchResults.length}
            groupCount={page.results.groups.length}
            allGroupsCollapsed={page.results.allGroupsCollapsed}
            onToggleAllGroups={page.results.handleToggleAllGroups}
            groups={page.results.groups}
            collapsedGroups={page.results.collapsedGroups}
            onToggleGroup={page.results.toggleGroup}
            onCopyMagnet={page.results.handleCopyMagnet}
            onPlay={page.results.handlePlay}
            showBestAi={page.ai.selectedAiAlias !== "none"}
          />
        )}
    </div>
  );
}

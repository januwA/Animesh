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
import { FilterForm } from "./FilterForm";
import { SearchForm } from "./SearchForm";
import { SearchHistory } from "./SearchHistory";
import { SearchLoading } from "./SearchLoading";
import { SearchResultsList } from "./SearchResultsList";
import { useTorrentSearchPage } from "./useTorrentSearchPage";

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
  const { searchTorrentsUseCase } = useDI();

  const page = useTorrentSearchPage(keyword, {
    searchTorrentsUseCase,
  });

  const StatusPanel = () => {
    if (page.status.loading) {
      return <SearchLoading onCancel={page.status.handleCancel} />;
    }

    if (page.status.error) {
      return (
        <ErrorState
          message={page.status.error}
          title="搜索失败"
          onRetry={() =>
            page.search.performSearch(
              page.search.searchKeyword,
              page.search.searchEngines,
            )
          }
        />
      );
    }

    if (page.results.searchResults) {
      if (page.results.searchResults.length) {
        return (
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
          />
        );
      } else {
        return (
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
        );
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SearchForm
        form={page.search.form}
        loading={page.status.loading}
        onSubmit={page.search.handleSearch}
      />

      <FilterForm />

      <SearchHistory
        history={page.searchHistory.history}
        onSelectKeyword={page.search.setSearchKeyword}
        onDelete={page.searchHistory.handleDeleteHistory}
        onClear={page.searchHistory.handleClearHistory}
      />

      {StatusPanel()}
    </div>
  );
}

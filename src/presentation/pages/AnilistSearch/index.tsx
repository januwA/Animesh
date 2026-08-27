import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import { ErrorState } from "@/presentation/components/ErrorState";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { SubjectSearchForm } from "@/presentation/components/SubjectSearchForm";
import { SubjectSearchLoading } from "@/presentation/components/SubjectSearchLoading";
import { SubjectSearchResults } from "@/presentation/components/SubjectSearchResults";
import { useAnilistSearchStore } from "@/presentation/store/anilistSearchStore";
import { useSubjectSearchPage } from "../BangumiSearch/useSubjectSearchPage";

const keywordParamSchema = z
  .string()
  .trim()
  .min(1, "搜索关键词不能为空")
  .optional();

export default function AnilistSearch() {
  const [searchParams] = useSearchParams();
  const keywordResult = keywordParamSchema.safeParse(
    searchParams.get("keyword") ?? undefined,
  );

  if (!keywordResult.success) {
    return (
      <InvalidParamsView title="无效的搜索参数" error={keywordResult.error} />
    );
  }

  return <AnilistSearchView keywordParam={keywordResult.data} />;
}

function AnilistSearchView({
  keywordParam,
}: {
  keywordParam: string | undefined;
}) {
  const { searchAnilistSubjectsUseCase } = useDI();
  const page = useSubjectSearchPage(
    keywordParam,
    { searchSubjectsUseCase: searchAnilistSubjectsUseCase },
    useAnilistSearchStore,
    (id) => `/anilist/subject/${id}`,
  );

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">AniList 搜索</h1>
        <p className="text-sm text-muted-foreground">搜索 AniList 动漫条目</p>
      </div>

      <SubjectSearchForm
        keyword={page.search.keyword}
        setKeyword={page.search.setKeyword}
        loading={page.status.loading}
        onSubmit={page.search.handleSearch}
        placeholder="输入动漫名称"
        searchingText="搜索中..."
      />

      {page.status.loading ? (
        <SubjectSearchLoading onCancel={page.status.handleCancel} />
      ) : page.status.error ? (
        <ErrorState
          title="搜索失败"
          message={page.status.error}
          onRetry={() => page.search.performSearch(page.search.keyword)}
        />
      ) : page.status.hasSearched ? (
        <SubjectSearchResults
          items={page.results.items}
          onSubjectClick={page.results.handleSubjectClick}
          hasMore={page.status.hasMore}
          loadingMore={page.status.loadingMore}
          onLoadMore={page.results.onLoadMore}
        />
      ) : null}
    </div>
  );
}

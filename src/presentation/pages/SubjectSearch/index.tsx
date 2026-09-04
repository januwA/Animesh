import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import { AnimePlatformSchema } from "@/domain/anime/AnimeSchemas";
import { ErrorState } from "@/presentation/components/ErrorState";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { SubjectSearchForm } from "@/presentation/pages/SubjectSearch/SubjectSearchForm";
import { SubjectSearchLoading } from "@/presentation/pages/SubjectSearch/SubjectSearchLoading";
import { SubjectSearchResults } from "@/presentation/pages/SubjectSearch/SubjectSearchResults";
import { useAnilistSearchStore } from "@/presentation/store/anilistSearchStore";
import { useBangumiSearchStore } from "@/presentation/store/bangumiSearchStore";
import { useSubjectSearchPage } from "./useSubjectSearchPage";

const keywordParamSchema = z
  .string()
  .trim()
  .min(1, "搜索关键词不能为空")
  .optional();

const platformConfigs = {
  bangumi: {
    title: "搜索 Bangumi 动漫条目",
    getUseCase: (di: ReturnType<typeof useDI>) =>
      di.searchBangumiSubjectsUseCase,
    useStore: useBangumiSearchStore,
    subjectPath: (id: number) => `/anime/subject/${id}?platform=bangumi`,
  },
  anilist: {
    title: "搜索 AniList 动漫条目",
    getUseCase: (di: ReturnType<typeof useDI>) =>
      di.searchAnilistSubjectsUseCase,
    useStore: useAnilistSearchStore,
    subjectPath: (id: number) => `/anime/subject/${id}?platform=anilist`,
  },
} as const;

export default function SubjectSearch() {
  const [searchParams] = useSearchParams();
  const platformResult = AnimePlatformSchema.safeParse(
    searchParams.get("platform"),
  );
  const keywordResult = keywordParamSchema.safeParse(
    searchParams.get("keyword") ?? undefined,
  );

  if (!platformResult.success) {
    return (
      <InvalidParamsView
        title="缺少 platform 参数"
        error={platformResult.error}
      />
    );
  }

  if (!keywordResult.success) {
    return (
      <InvalidParamsView title="无效的搜索参数" error={keywordResult.error} />
    );
  }

  return (
    <SubjectSearchView
      platform={platformResult.data}
      keywordParam={keywordResult.data}
    />
  );
}

function SubjectSearchView({
  platform,
  keywordParam,
}: {
  platform: AnimePlatform;
  keywordParam: string | undefined;
}) {
  const di = useDI();
  const config = platformConfigs[platform];
  const page = useSubjectSearchPage(
    keywordParam,
    { searchSubjectsUseCase: config.getUseCase(di) },
    config.useStore,
    config.subjectPath,
  );

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{config.title}</h1>
      </div>

      <SubjectSearchForm
        keyword={page.search.keyword}
        setKeyword={page.search.setKeyword}
        loading={page.status.loading}
        onSubmit={page.search.handleSearch}
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

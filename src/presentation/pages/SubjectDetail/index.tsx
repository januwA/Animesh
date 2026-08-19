import { useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import { ErrorState } from "@/presentation/components/ErrorState";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { Badge } from "@/presentation/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/presentation/components/ui/tabs";
import { useTorrentStatus } from "@/presentation/context/TorrentStatusContext";
import { CharactersSection } from "./CharactersSection";
import { EpisodesSection } from "./EpisodesSection";
import { StaffSection } from "./StaffSection";
import { SubjectBackButton } from "./SubjectBackButton";
import { SubjectInfoCard } from "./SubjectInfoCard";
import { SubjectNavigationHeader } from "./SubjectNavigationHeader";
import { SubjectResourcesTab } from "./SubjectResourcesTab";
import { SummarySection } from "./SummarySection";
import { useSubjectDetail } from "./useSubjectDetail";

const subjectParamsSchema = z.object({
  subjectId: z
    .string({ message: "缺少条目 ID 参数" })
    .min(1, "缺少条目 ID 参数")
    .regex(/^\d+$/, "条目 ID 必须是数字"),
});

const pageParamSchema = z
  .string()
  .regex(/^\d+$/, "页码必须是数字")
  .optional()
  .default("1");

export default function SubjectDetail() {
  const { subjectId = "" } = useParams<{ subjectId: string }>();
  const [searchParams] = useSearchParams();

  const subjectResult = subjectParamsSchema.safeParse({ subjectId });
  const pageResult = pageParamSchema.safeParse(
    searchParams.get("page") ?? undefined,
  );

  if (!subjectResult.success) {
    return (
      <InvalidParamsView
        title="无效的条目详情参数"
        error={subjectResult.error}
      />
    );
  }
  if (!pageResult.success) {
    return (
      <InvalidParamsView title="无效的条目详情参数" error={pageResult.error} />
    );
  }

  return (
    <SubjectDetailView
      subjectId={Number(subjectResult.data.subjectId)}
      page={Number(pageResult.data)}
    />
  );
}

function SubjectDetailView({
  subjectId,
  page,
}: {
  subjectId: number;
  page: number;
}) {
  const {
    getBangumiSubjectUseCase,
    getBangumiEpisodesUseCase,
    getBangumiPersonsUseCase,
    getBangumiCharactersUseCase,
    getFavoriteStatusUseCase,
    addFavoriteUseCase,
    removeFavoriteUseCase,
    openUrlUseCase,
    setTorrentSubjectUseCase,
    clearTorrentSubjectUseCase,
  } = useDI();
  const { torrents } = useTorrentStatus();

  const pageState = useSubjectDetail(
    { subjectId, page, torrents },
    {
      getBangumiSubjectUseCase,
      getBangumiEpisodesUseCase,
      getBangumiPersonsUseCase,
      getBangumiCharactersUseCase,
      openUrlUseCase,
      setTorrentSubjectUseCase,
      clearTorrentSubjectUseCase,
    },
  );

  if (pageState.subjectQuery.error) {
    return (
      <div className="space-y-4">
        <SubjectBackButton onBack={pageState.handleBack} />
        <ErrorState
          title="获取动漫详情失败"
          message={pageState.subjectQuery.error}
          onRetry={pageState.subjectQuery.refetch}
        />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Navigation Header */}
      <SubjectNavigationHeader
        subject={pageState.subject}
        displayName={pageState.displayName}
        onBack={pageState.handleBack}
        onOpenUrl={pageState.handleOpenUrl}
        getFavoriteStatusUseCase={getFavoriteStatusUseCase}
        addFavoriteUseCase={addFavoriteUseCase}
        removeFavoriteUseCase={removeFavoriteUseCase}
      />

      {/* Info Header Card */}
      <SubjectInfoCard
        subject={pageState.subject}
        subjectId={subjectId}
        displayName={pageState.displayName}
        originalName={pageState.originalName}
        imageUrl={pageState.imageUrl}
      />

      {/* Episodes List */}
      <EpisodesSection
        episodes={pageState.episodes}
        totalEpisodes={pageState.totalEpisodes}
        totalPages={pageState.totalPages}
        page={page}
        todayStr={pageState.todayStr}
        loading={pageState.episodesQuery.loading}
        error={pageState.episodesQuery.error}
        onRetry={pageState.episodesQuery.refetch}
        onEpisodeClick={pageState.handleEpisodeClick}
        onPageChange={pageState.changePage}
        onJumpToEpisode={pageState.jumpToEpisode}
      />

      {/* Content Tabs */}
      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">简介</TabsTrigger>
          <TabsTrigger value="characters">
            角色
            {pageState.characters.length > 0 && (
              <Badge variant="secondary">{pageState.characters.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="staff">
            制作人员
            {pageState.persons.length > 0 && (
              <Badge variant="secondary">
                {pageState.consolidatedStaff.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="resources">
            资源
            {pageState.boundResourcesCount > 0 && (
              <Badge variant="secondary">{pageState.boundResourcesCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="pt-4">
          <SummarySection subject={pageState.subject} />
        </TabsContent>

        <TabsContent value="characters" className="pt-4">
          <CharactersSection
            characters={pageState.characters}
            loading={pageState.charactersQuery.loading}
            error={pageState.charactersQuery.error}
            onRetry={pageState.charactersQuery.refetch}
          />
        </TabsContent>

        <TabsContent value="staff" className="pt-4">
          <StaffSection
            staffGroupedByRole={pageState.staffGroupedByRole}
            loading={pageState.personsQuery.loading}
            error={pageState.personsQuery.error}
            onRetry={pageState.personsQuery.refetch}
          />
        </TabsContent>

        <TabsContent value="resources" className="pt-0">
          <SubjectResourcesTab
            subjectName={pageState.displayName}
            boundTorrents={pageState.boundTorrents}
            unboundTorrents={pageState.unboundTorrents}
            bindLoading={pageState.bindLoading}
            unbindLoading={pageState.unbindLoading}
            onBind={pageState.handleBind}
            onUnbind={pageState.handleUnbind}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

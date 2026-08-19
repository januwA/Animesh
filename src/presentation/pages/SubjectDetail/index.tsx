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

  const detail = useSubjectDetail(
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

  if (detail.info.subjectQuery.error) {
    return (
      <div className="space-y-4">
        <SubjectBackButton onBack={detail.info.handleBack} />
        <ErrorState
          title="获取动漫详情失败"
          message={detail.info.subjectQuery.error}
          onRetry={detail.info.subjectQuery.refetch}
        />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Navigation Header */}
      <SubjectNavigationHeader
        subject={detail.info.subject}
        displayName={detail.info.displayName}
        onBack={detail.info.handleBack}
        onOpenUrl={detail.info.handleOpenUrl}
        getFavoriteStatusUseCase={getFavoriteStatusUseCase}
        addFavoriteUseCase={addFavoriteUseCase}
        removeFavoriteUseCase={removeFavoriteUseCase}
      />

      {/* Info Header Card */}
      <SubjectInfoCard
        subject={detail.info.subject}
        subjectId={subjectId}
        displayName={detail.info.displayName}
        originalName={detail.info.originalName}
        imageUrl={detail.info.imageUrl}
      />

      {/* Episodes List */}
      <EpisodesSection
        episodes={detail.episodes.episodes}
        totalEpisodes={detail.episodes.totalEpisodes}
        totalPages={detail.episodes.totalPages}
        page={page}
        todayStr={detail.episodes.todayStr}
        loading={detail.episodes.episodesQuery.loading}
        error={detail.episodes.episodesQuery.error}
        onRetry={detail.episodes.episodesQuery.refetch}
        onEpisodeClick={detail.episodes.handleEpisodeClick}
        onPageChange={detail.episodes.changePage}
        onJumpToEpisode={detail.episodes.jumpToEpisode}
      />

      {/* Content Tabs */}
      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">简介</TabsTrigger>
          <TabsTrigger value="characters">
            角色
            {detail.cast.characters.length > 0 && (
              <Badge variant="secondary">{detail.cast.characters.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="staff">
            制作人员
            {detail.cast.persons.length > 0 && (
              <Badge variant="secondary">
                {detail.cast.consolidatedStaff.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="resources">
            资源
            {detail.resources.boundResourcesCount > 0 && (
              <Badge variant="secondary">
                {detail.resources.boundResourcesCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="pt-4">
          <SummarySection subject={detail.info.subject} />
        </TabsContent>

        <TabsContent value="characters" className="pt-4">
          <CharactersSection
            characters={detail.cast.characters}
            loading={detail.cast.charactersQuery.loading}
            error={detail.cast.charactersQuery.error}
            onRetry={detail.cast.charactersQuery.refetch}
          />
        </TabsContent>

        <TabsContent value="staff" className="pt-4">
          <StaffSection
            staffGroupedByRole={detail.cast.staffGroupedByRole}
            loading={detail.cast.personsQuery.loading}
            error={detail.cast.personsQuery.error}
            onRetry={detail.cast.personsQuery.refetch}
          />
        </TabsContent>

        <TabsContent value="resources" className="pt-0">
          <SubjectResourcesTab
            subjectName={detail.info.displayName}
            boundTorrents={detail.resources.boundTorrents}
            unboundTorrents={detail.resources.unboundTorrents}
            bindLoading={detail.resources.bindLoading}
            unbindLoading={detail.resources.unbindLoading}
            onBind={detail.resources.handleBind}
            onUnbind={detail.resources.handleUnbind}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

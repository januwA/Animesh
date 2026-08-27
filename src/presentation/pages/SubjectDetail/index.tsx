import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import { CharactersSection } from "@/presentation/components/CharactersSection";
import { EpisodesSection } from "@/presentation/components/EpisodesSection";
import { ErrorState } from "@/presentation/components/ErrorState";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { StaffSection } from "@/presentation/components/StaffSection";
import { SubjectInfoCard } from "@/presentation/components/SubjectInfoCard";
import { SubjectResourcesTab } from "@/presentation/components/SubjectResourcesTab";
import { SummarySection } from "@/presentation/components/SummarySection";
import { Badge } from "@/presentation/components/ui/badge";
import { Card, CardContent } from "@/presentation/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/presentation/components/ui/tabs";
import { useTorrentStatus } from "@/presentation/context/TorrentStatusContext";
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
  const [activeTab, setActiveTab] = useState("summary");

  const detail = useSubjectDetail(
    { subjectId, page, platform: "bangumi", torrents, activeTab },
    {
      getSubjectUseCase: getBangumiSubjectUseCase,
      getEpisodesUseCase: getBangumiEpisodesUseCase,
      getPersonsUseCase: getBangumiPersonsUseCase,
      getCharactersUseCase: getBangumiCharactersUseCase,
      openUrlUseCase,
      setTorrentSubjectUseCase,
      clearTorrentSubjectUseCase,
    },
  );

  if (detail.info.subjectQuery.error) {
    return (
      <div className="space-y-4">
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
      {/* Info Header Card */}
      <SubjectInfoCard
        subject={detail.info.subject}
        subjectId={subjectId}
        platform="bangumi"
        displayName={detail.info.displayName}
        imageUrl={detail.info.imageUrl}
        onOpenUrl={detail.info.handleOpenUrl}
        getFavoriteStatusUseCase={getFavoriteStatusUseCase}
        addFavoriteUseCase={addFavoriteUseCase}
        removeFavoriteUseCase={removeFavoriteUseCase}
      />

      {/* Episodes List */}
      <Card className="ani-card">
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
          <Card className="ani-card">
            <CardContent>
              <CharactersSection
                characters={detail.cast.characters}
                loading={detail.cast.charactersQuery.loading}
                error={detail.cast.charactersQuery.error}
                onRetry={detail.cast.charactersQuery.refetch}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="pt-4">
          <Card className="ani-card">
            <CardContent>
              <StaffSection
                staffGroupedByRole={detail.cast.staffGroupedByRole}
                loading={detail.cast.personsQuery.loading}
                error={detail.cast.personsQuery.error}
                onRetry={detail.cast.personsQuery.refetch}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="pt-0">
          <Card className="ani-card">
            <CardContent>
              <SubjectResourcesTab
                subjectName={detail.info.displayName}
                boundTorrents={detail.resources.boundTorrents}
                unboundTorrents={detail.resources.unboundTorrents}
                bindLoading={detail.resources.bindLoading}
                unbindLoading={detail.resources.unbindLoading}
                onBind={detail.resources.handleBind}
                onUnbind={detail.resources.handleUnbind}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

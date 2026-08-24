import { useState } from "react";
import { useParams } from "react-router-dom";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import { CharactersSection } from "@/presentation/components/CharactersSection";
import { EpisodesSection } from "@/presentation/components/EpisodesSection";
import { ErrorState } from "@/presentation/components/ErrorState";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { StaffSection } from "@/presentation/components/StaffSection";
import { SubjectInfoCard } from "@/presentation/components/SubjectInfoCard";
import { SummarySection } from "@/presentation/components/SummarySection";
import { Badge } from "@/presentation/components/ui/badge";
import { Card, CardContent } from "@/presentation/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/presentation/components/ui/tabs";
import { useAnilistSubjectDetail } from "./useAnilistSubjectDetail";

const subjectParamsSchema = z.object({
  subjectId: z
    .string({ message: "缺少条目 ID 参数" })
    .min(1, "缺少条目 ID 参数")
    .regex(/^\d+$/, "条目 ID 必须是数字"),
});

export default function AnilistSubjectDetail() {
  const { subjectId = "" } = useParams<{ subjectId: string }>();

  const subjectResult = subjectParamsSchema.safeParse({ subjectId });

  if (!subjectResult.success) {
    return (
      <InvalidParamsView
        title="无效的条目详情参数"
        error={subjectResult.error}
      />
    );
  }

  return (
    <AnilistSubjectDetailView
      subjectId={Number(subjectResult.data.subjectId)}
    />
  );
}

function AnilistSubjectDetailView({ subjectId }: { subjectId: number }) {
  const {
    getAnilistSubjectUseCase,
    getAnilistEpisodesUseCase,
    getAnilistPersonsUseCase,
    getAnilistCharactersUseCase,
    openUrlUseCase,
  } = useDI();
  const [activeTab, setActiveTab] = useState("summary");

  const detail = useAnilistSubjectDetail(
    { subjectId, page: 1, activeTab },
    {
      getAnilistSubjectUseCase,
      getAnilistEpisodesUseCase,
      getAnilistPersonsUseCase,
      getAnilistCharactersUseCase,
      openUrlUseCase,
    },
  );

  if (detail.info.subjectQuery.error) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="获取 AniList 动漫详情失败"
          message={detail.info.subjectQuery.error}
          onRetry={detail.info.subjectQuery.refetch}
        />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      <SubjectInfoCard
        subject={detail.info.subject}
        subjectId={subjectId}
        displayName={detail.info.displayName}
        imageUrl={detail.info.imageUrl}
        onOpenUrl={detail.info.handleOpenUrl}
        getFavoriteStatusUseCase={{
          execute: () => Promise.resolve(false),
        }}
        addFavoriteUseCase={{
          execute: () => Promise.resolve(),
        }}
        removeFavoriteUseCase={{
          execute: () => Promise.resolve(),
        }}
      />

      {detail.episodes.episodes.length > 0 && (
        <Card className="ani-card">
          <CardContent>
            <EpisodesSection
              episodes={detail.episodes.episodes}
              totalEpisodes={detail.episodes.totalEpisodes}
              totalPages={detail.episodes.totalPages}
              page={1}
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
      )}

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
      </Tabs>
    </div>
  );
}

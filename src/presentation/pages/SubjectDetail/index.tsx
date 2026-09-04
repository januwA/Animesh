import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import type { GetAnimeCharactersUseCase } from "@/application/anime/GetAnimeCharactersUseCase";
import { type DIContainer, useDI } from "@/di/DIContext";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import { AnimePlatformSchema } from "@/domain/anime/AnimeSchemas";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { Card, CardContent } from "@/presentation/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/presentation/components/ui/tabs";
import { useTorrentStatus } from "@/presentation/context/TorrentStatusContext";
import { CharactersSection } from "@/presentation/pages/SubjectDetail/CharactersSection";
import { EpisodesSection } from "@/presentation/pages/SubjectDetail/EpisodesSection";
import { StaffSection } from "@/presentation/pages/SubjectDetail/StaffSection";
import { SubjectInfoCard } from "@/presentation/pages/SubjectDetail/SubjectInfoCard";
import { SubjectResourcesTab } from "@/presentation/pages/SubjectDetail/SubjectResourcesTab";
import { SummarySection } from "@/presentation/pages/SubjectDetail/SummarySection";
import type { UseSubjectStaffDeps } from "./useSubjectCast";
import type { UseSubjectEpisodesDeps } from "./useSubjectEpisodes";
import { type UseSubjectInfoDeps, useSubjectInfo } from "./useSubjectInfo";
import type { UseSubjectResourcesDeps } from "./useSubjectResources";

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

/** 根据平台组装各 Section 所需的使用用例依赖，由页面组合根统一注入 */
function buildSectionDeps(
  di: DIContainer,
  platform: AnimePlatform,
): {
  getCharactersUseCase: GetAnimeCharactersUseCase;
  infoDeps: UseSubjectInfoDeps;
  episodesDeps: UseSubjectEpisodesDeps;
  staffDeps: UseSubjectStaffDeps;
  resourcesDeps: UseSubjectResourcesDeps;
} {
  const animeDeps =
    platform === "bangumi"
      ? {
          getSubjectUseCase: di.getBangumiSubjectUseCase,
          getEpisodesUseCase: di.getBangumiEpisodesUseCase,
          getPersonsUseCase: di.getBangumiPersonsUseCase,
          getCharactersUseCase: di.getBangumiCharactersUseCase,
        }
      : {
          getSubjectUseCase: di.getAnilistSubjectUseCase,
          getEpisodesUseCase: di.getAnilistEpisodesUseCase,
          getPersonsUseCase: di.getAnilistPersonsUseCase,
          getCharactersUseCase: di.getAnilistCharactersUseCase,
        };

  return {
    getCharactersUseCase: animeDeps.getCharactersUseCase,
    infoDeps: {
      getSubjectUseCase: animeDeps.getSubjectUseCase,
      openUrlUseCase: di.openUrlUseCase,
    },
    episodesDeps: {
      getAnimeEpisodesUseCase: animeDeps.getEpisodesUseCase,
    },
    staffDeps: {
      getAnimePersonsUseCase: animeDeps.getPersonsUseCase,
    },
    resourcesDeps: {
      setTorrentSubjectUseCase: di.setTorrentSubjectUseCase,
      clearTorrentSubjectUseCase: di.clearTorrentSubjectUseCase,
    },
  };
}

export default function SubjectDetail() {
  const { subjectId = "" } = useParams<{ subjectId: string }>();
  const [searchParams] = useSearchParams();
  const platformResult = AnimePlatformSchema.safeParse(
    searchParams.get("platform"),
  );

  if (!platformResult.success) {
    return (
      <InvalidParamsView
        title="缺少 platform 参数"
        error={platformResult.error}
      />
    );
  }

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
      platform={platformResult.data}
      subjectId={Number(subjectResult.data.subjectId)}
      page={Number(pageResult.data)}
    />
  );
}

function SubjectDetailView({
  platform,
  subjectId,
  page,
}: {
  platform: AnimePlatform;
  subjectId: number;
  page: number;
}) {
  const di = useDI();
  const { torrents } = useTorrentStatus();
  const [activeTab, setActiveTab] = useState("summary");

  const deps = buildSectionDeps(di, platform);
  const info = useSubjectInfo({ subjectId, platform }, deps.infoDeps);

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Info Header Card */}
      <SubjectInfoCard
        subject={info.subject}
        subjectId={subjectId}
        platform={platform}
        displayName={info.displayName}
        imageUrl={info.imageUrl}
        onOpenUrl={info.handleOpenUrl}
        error={info.subjectQuery.error}
        onRetry={info.subjectQuery.refetch}
        getFavoriteStatusUseCase={di.getFavoriteStatusUseCase}
        addFavoriteUseCase={di.addFavoriteUseCase}
        removeFavoriteUseCase={di.removeFavoriteUseCase}
      />

      {/* Episodes List */}
      <Card className="ani-card">
        <CardContent>
          <EpisodesSection
            subjectId={subjectId}
            page={page}
            subject={info.subject}
            deps={deps.episodesDeps}
          />
        </CardContent>
      </Card>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="summary">简介</TabsTrigger>
          <TabsTrigger value="characters">角色</TabsTrigger>
          <TabsTrigger value="staff">制作人员</TabsTrigger>
          <TabsTrigger value="resources">资源</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="pt-4">
          <SummarySection subject={info.subject} />
        </TabsContent>

        <TabsContent value="characters" className="pt-4">
          <Card className="ani-card">
            <CardContent>
              <CharactersSection
                subjectId={subjectId}
                getCharactersUseCase={deps.getCharactersUseCase}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="pt-4">
          <Card className="ani-card">
            <CardContent>
              <StaffSection subjectId={subjectId} deps={deps.staffDeps} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="pt-0">
          <Card className="ani-card">
            <CardContent>
              <SubjectResourcesTab
                subjectId={subjectId}
                platform={platform}
                subjectName={info.displayName}
                torrents={torrents}
                deps={deps.resourcesDeps}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import type { GetAnimeCharactersUseCase } from "@/application/anime/GetAnimeCharactersUseCase";
import type { GetAnimeEpisodesUseCase } from "@/application/anime/GetAnimeEpisodesUseCase";
import type { GetAnimePersonsUseCase } from "@/application/anime/GetAnimePersonsUseCase";
import type { GetAnimeSubjectUseCase } from "@/application/anime/GetAnimeSubjectUseCase";
import type { OpenUrlUseCase } from "@/application/opener/OpenUrlUseCase";
import type { SubjectCastResult } from "@/presentation/hooks/useSubjectCast";
import { useSubjectCast } from "@/presentation/hooks/useSubjectCast";
import type { SubjectEpisodesResult } from "@/presentation/hooks/useSubjectEpisodes";
import { useSubjectEpisodes } from "@/presentation/hooks/useSubjectEpisodes";
import type { SubjectInfoResult } from "@/presentation/hooks/useSubjectInfo";
import { useSubjectInfo } from "@/presentation/hooks/useSubjectInfo";

export interface UseAnilistSubjectDetailParams {
  subjectId: number;
  page: number;
  activeTab: string;
}

export interface UseAnilistSubjectDetailDeps {
  getAnilistSubjectUseCase: Pick<GetAnimeSubjectUseCase, "execute">;
  getAnilistEpisodesUseCase: Pick<GetAnimeEpisodesUseCase, "execute">;
  getAnilistPersonsUseCase: Pick<GetAnimePersonsUseCase, "execute">;
  getAnilistCharactersUseCase: Pick<GetAnimeCharactersUseCase, "execute">;
  openUrlUseCase: Pick<OpenUrlUseCase, "execute">;
}

export interface AnilistSubjectDetailResult {
  info: SubjectInfoResult;
  episodes: SubjectEpisodesResult;
  cast: SubjectCastResult;
}

const ANILIST_EXTERNAL_URL = (subject: { id: number }) =>
  `https://anilist.co/anime/${subject.id}`;

export function useAnilistSubjectDetail(
  params: UseAnilistSubjectDetailParams,
  deps: UseAnilistSubjectDetailDeps,
): AnilistSubjectDetailResult {
  const { subjectId, page, activeTab } = params;
  const {
    getAnilistSubjectUseCase,
    getAnilistEpisodesUseCase,
    getAnilistPersonsUseCase,
    getAnilistCharactersUseCase,
    openUrlUseCase,
  } = deps;

  const info = useSubjectInfo(
    { subjectId, externalUrl: ANILIST_EXTERNAL_URL },
    { getSubjectUseCase: getAnilistSubjectUseCase, openUrlUseCase },
  );

  const episodes = useSubjectEpisodes(
    { subjectId, page, subject: info.subject },
    { getBangumiEpisodesUseCase: getAnilistEpisodesUseCase },
  );

  const cast = useSubjectCast(
    {
      subjectId,
      enabledCharacters: activeTab === "characters",
      enabledPersons: activeTab === "staff",
    },
    {
      getBangumiPersonsUseCase: getAnilistPersonsUseCase,
      getBangumiCharactersUseCase: getAnilistCharactersUseCase,
    },
  );

  return { info, episodes, cast };
}

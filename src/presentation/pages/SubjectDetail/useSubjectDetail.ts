import type { GetAnimeCharactersUseCase } from "@/application/anime/GetAnimeCharactersUseCase";
import type { GetAnimeEpisodesUseCase } from "@/application/anime/GetAnimeEpisodesUseCase";
import type { GetAnimePersonsUseCase } from "@/application/anime/GetAnimePersonsUseCase";
import type { GetAnimeSubjectUseCase } from "@/application/anime/GetAnimeSubjectUseCase";
import type { OpenUrlUseCase } from "@/application/opener/OpenUrlUseCase";
import type { ClearTorrentSubjectUseCase } from "@/application/torrent/ClearTorrentSubjectUseCase";
import type { SetTorrentSubjectUseCase } from "@/application/torrent/SetTorrentSubjectUseCase";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import type { SubjectCastResult } from "@/presentation/hooks/useSubjectCast";
import { useSubjectCast } from "@/presentation/hooks/useSubjectCast";
import type { SubjectEpisodesResult } from "@/presentation/hooks/useSubjectEpisodes";
import { useSubjectEpisodes } from "@/presentation/hooks/useSubjectEpisodes";
import type { SubjectInfoResult } from "@/presentation/hooks/useSubjectInfo";
import { useSubjectInfo } from "@/presentation/hooks/useSubjectInfo";
import type { SubjectResourcesResult } from "@/presentation/hooks/useSubjectResources";
import { useSubjectResources } from "@/presentation/hooks/useSubjectResources";

export interface UseSubjectDetailParams {
  subjectId: number;
  page: number;
  platform: AnimePlatform;
  torrents: TorrentStatusInfo[];
  activeTab: string;
}

export interface UseSubjectDetailDeps {
  getSubjectUseCase: Pick<GetAnimeSubjectUseCase, "execute">;
  getEpisodesUseCase: Pick<GetAnimeEpisodesUseCase, "execute">;
  getPersonsUseCase: Pick<GetAnimePersonsUseCase, "execute">;
  getCharactersUseCase: Pick<GetAnimeCharactersUseCase, "execute">;
  openUrlUseCase: Pick<OpenUrlUseCase, "execute">;
  setTorrentSubjectUseCase: Pick<SetTorrentSubjectUseCase, "execute">;
  clearTorrentSubjectUseCase: Pick<ClearTorrentSubjectUseCase, "execute">;
}

export interface SubjectDetailResult {
  info: SubjectInfoResult;
  episodes: SubjectEpisodesResult;
  cast: SubjectCastResult;
  resources: SubjectResourcesResult;
}

export function useSubjectDetail(
  params: UseSubjectDetailParams,
  deps: UseSubjectDetailDeps,
): SubjectDetailResult {
  const { subjectId, page, platform, torrents, activeTab } = params;
  const {
    getSubjectUseCase,
    getEpisodesUseCase,
    getPersonsUseCase,
    getCharactersUseCase,
    openUrlUseCase,
    setTorrentSubjectUseCase,
    clearTorrentSubjectUseCase,
  } = deps;

  const info = useSubjectInfo(
    { subjectId, platform },
    { getSubjectUseCase, openUrlUseCase },
  );

  const episodes = useSubjectEpisodes(
    { subjectId, page, subject: info.subject },
    { getAnimeEpisodesUseCase: getEpisodesUseCase },
  );

  const cast = useSubjectCast(
    {
      subjectId,
      enabledCharacters: activeTab === "characters",
      enabledPersons: activeTab === "staff",
    },
    {
      getAnimePersonsUseCase: getPersonsUseCase,
      getAnimeCharactersUseCase: getCharactersUseCase,
    },
  );

  const resources = useSubjectResources(
    { subjectId, platform, torrents, subjectName: info.displayName },
    { setTorrentSubjectUseCase, clearTorrentSubjectUseCase },
  );

  return { info, episodes, cast, resources };
}

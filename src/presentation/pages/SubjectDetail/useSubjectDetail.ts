import type { GetAnimeCharactersUseCase } from "@/application/anime/GetAnimeCharactersUseCase";
import type { GetAnimeEpisodesUseCase } from "@/application/anime/GetAnimeEpisodesUseCase";
import type { GetAnimePersonsUseCase } from "@/application/anime/GetAnimePersonsUseCase";
import type { GetAnimeSubjectUseCase } from "@/application/anime/GetAnimeSubjectUseCase";
import type { OpenUrlUseCase } from "@/application/opener/OpenUrlUseCase";
import type { ClearTorrentSubjectUseCase } from "@/application/torrent/ClearTorrentSubjectUseCase";
import type { SetTorrentSubjectUseCase } from "@/application/torrent/SetTorrentSubjectUseCase";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import type { SubjectCastResult } from "./useSubjectCast";
import { useSubjectCast } from "./useSubjectCast";
import type { SubjectEpisodesResult } from "./useSubjectEpisodes";
import { useSubjectEpisodes } from "./useSubjectEpisodes";
import type { SubjectInfoResult } from "./useSubjectInfo";
import { useSubjectInfo } from "./useSubjectInfo";
import type { SubjectResourcesResult } from "./useSubjectResources";
import { useSubjectResources } from "./useSubjectResources";

export type { ConsolidatedStaffMember } from "./useSubjectCast";

export interface UseSubjectDetailParams {
  subjectId: number;
  page: number;
  torrents: TorrentStatusInfo[];
  activeTab: string;
}

/** useSubjectDetail 的依赖，由调用方（页面组合根）注入 */
export interface UseSubjectDetailDeps {
  getBangumiSubjectUseCase: Pick<GetAnimeSubjectUseCase, "execute">;
  getBangumiEpisodesUseCase: Pick<GetAnimeEpisodesUseCase, "execute">;
  getBangumiPersonsUseCase: Pick<GetAnimePersonsUseCase, "execute">;
  getBangumiCharactersUseCase: Pick<GetAnimeCharactersUseCase, "execute">;
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
  const { subjectId, page, torrents, activeTab } = params;
  const {
    getBangumiSubjectUseCase,
    getBangumiEpisodesUseCase,
    getBangumiPersonsUseCase,
    getBangumiCharactersUseCase,
    openUrlUseCase,
    setTorrentSubjectUseCase,
    clearTorrentSubjectUseCase,
  } = deps;

  const info = useSubjectInfo(
    { subjectId },
    { getBangumiSubjectUseCase, openUrlUseCase },
  );

  const episodes = useSubjectEpisodes(
    { subjectId, page, subject: info.subject },
    { getBangumiEpisodesUseCase },
  );

  const cast = useSubjectCast(
    {
      subjectId,
      enabledCharacters: activeTab === "characters",
      enabledPersons: activeTab === "staff",
    },
    { getBangumiPersonsUseCase, getBangumiCharactersUseCase },
  );

  const resources = useSubjectResources(
    { subjectId, torrents, subjectName: info.displayName },
    { setTorrentSubjectUseCase, clearTorrentSubjectUseCase },
  );

  return { info, episodes, cast, resources };
}

import type { GetBangumiCharactersUseCase } from "@/application/bangumi/GetBangumiCharactersUseCase";
import type { GetBangumiEpisodesUseCase } from "@/application/bangumi/GetBangumiEpisodesUseCase";
import type { GetBangumiPersonsUseCase } from "@/application/bangumi/GetBangumiPersonsUseCase";
import type { GetBangumiSubjectUseCase } from "@/application/bangumi/GetBangumiSubjectUseCase";
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
  getBangumiSubjectUseCase: Pick<GetBangumiSubjectUseCase, "execute">;
  getBangumiEpisodesUseCase: Pick<GetBangumiEpisodesUseCase, "execute">;
  getBangumiPersonsUseCase: Pick<GetBangumiPersonsUseCase, "execute">;
  getBangumiCharactersUseCase: Pick<GetBangumiCharactersUseCase, "execute">;
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

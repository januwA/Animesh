import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { GetBangumiEpisodesUseCase } from "@/application/bangumi/GetBangumiEpisodesUseCase";
import type {
  BangumiEpisode,
  BangumiSubject,
} from "@/domain/bangumi/BangumiSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { UseQueryResult } from "@/presentation/hooks/useQuery";
import { useQuery } from "@/presentation/hooks/useQuery";

export const EPISODES_PAGE_SIZE = 50;

export interface EpisodesPageData {
  items: BangumiEpisode[];
  total: number;
}

export interface UseSubjectEpisodesParams {
  subjectId: number;
  page: number;
  subject: BangumiSubject | undefined;
}

/** useSubjectEpisodes 的依赖，由调用方（页面组合根）注入 */
export interface UseSubjectEpisodesDeps {
  getBangumiEpisodesUseCase: Pick<GetBangumiEpisodesUseCase, "execute">;
}

export interface SubjectEpisodesResult {
  episodesQuery: UseQueryResult<EpisodesPageData>;
  episodes: BangumiEpisode[];
  totalEpisodes: number;
  totalPages: number;
  todayStr: string;
  handleEpisodeClick: (episode: BangumiEpisode) => void;
  changePage: (nextPage: number) => void;
  jumpToEpisode: (episodeNumber: number) => void;
}

export function useSubjectEpisodes(
  params: UseSubjectEpisodesParams,
  deps: UseSubjectEpisodesDeps,
): SubjectEpisodesResult {
  const { subjectId, page, subject } = params;
  const { getBangumiEpisodesUseCase } = deps;

  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const episodesQuery = useQuery<EpisodesPageData>(
    async (ctx) => {
      const data = await getBangumiEpisodesUseCase.execute(ctx, {
        subjectId: NonEmptyStringSchema.parse(String(subjectId)),
        offset: (page - 1) * EPISODES_PAGE_SIZE,
        limit: EPISODES_PAGE_SIZE,
      });
      return {
        items: [...data.items].sort((a, b) => a.sort - b.sort),
        total: data.total,
      };
    },
    [subjectId, page, getBangumiEpisodesUseCase],
  );
  const episodes = episodesQuery.data?.items ?? [];
  const totalEpisodes = episodesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalEpisodes / EPISODES_PAGE_SIZE));

  const todayStr = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const handleEpisodeClick = (episode: BangumiEpisode) => {
    /* v8 ignore start */
    if (!subject) return;
    const epNum = String(episode.sort).padStart(2, "0");
    navigate(`/?keyword=${encodeURIComponent(`${subject.name} ${epNum}`)}`);
    /* v8 ignore stop */
  };

  const changePage = (nextPage: number) => {
    const clamped = Math.min(Math.max(1, nextPage), totalPages);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("page", String(clamped));
        return next;
      },
      { replace: true },
    );
  };

  const jumpToEpisode = (episodeNumber: number) => {
    const targetPage = Math.min(
      Math.max(1, Math.ceil(episodeNumber / EPISODES_PAGE_SIZE)),
      totalPages,
    );
    changePage(targetPage);
  };

  useEffect(() => {
    // v8 ignore start
    if (!episodesQuery.loading && episodesQuery.data && page > totalPages) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("page", String(totalPages));
          return next;
        },
        { replace: true },
      );
    }
    // v8 ignore stop
  }, [
    page,
    totalPages,
    episodesQuery.loading,
    episodesQuery.data,
    setSearchParams,
  ]);

  return {
    episodesQuery,
    episodes,
    totalEpisodes,
    totalPages,
    todayStr,
    handleEpisodeClick,
    changePage,
    jumpToEpisode,
  };
}

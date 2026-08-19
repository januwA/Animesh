import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import type { GetBangumiCharactersUseCase } from "@/application/bangumi/GetBangumiCharactersUseCase";
import type { GetBangumiEpisodesUseCase } from "@/application/bangumi/GetBangumiEpisodesUseCase";
import type { GetBangumiPersonsUseCase } from "@/application/bangumi/GetBangumiPersonsUseCase";
import type { GetBangumiSubjectUseCase } from "@/application/bangumi/GetBangumiSubjectUseCase";
import type { OpenUrlUseCase } from "@/application/opener/OpenUrlUseCase";
import type { ClearTorrentSubjectUseCase } from "@/application/torrent/ClearTorrentSubjectUseCase";
import type { SetTorrentSubjectUseCase } from "@/application/torrent/SetTorrentSubjectUseCase";
import type {
  BangumiCharacter,
  BangumiEpisode,
  BangumiPerson,
} from "@/domain/bangumi/BangumiSchemas";
import {
  type NonEmptyString,
  NonEmptyStringSchema,
} from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";
import { formatError } from "@/utils";

export const EPISODES_PAGE_SIZE = 50;

export interface ConsolidatedStaffMember {
  id: number;
  name: string;
  image: string;
  relations: string[];
  eps: string;
}

/** Deduplicate staff by (id, relation), then group by person ID to collect all roles. */
export function consolidateStaff(
  persons: BangumiPerson[],
): ConsolidatedStaffMember[] {
  const seen = new Set<string>();
  const personMap = new Map<number, ConsolidatedStaffMember>();

  for (const p of persons) {
    const key = `${p.id}|${p.relation}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const entry = personMap.get(p.id);
    if (entry) {
      entry.relations.push(p.relation);
    } else {
      const image =
        p.images.large ||
        p.images.medium ||
        p.images.small ||
        p.images.grid ||
        "";
      personMap.set(p.id, {
        id: p.id,
        name: p.name,
        image,
        relations: [p.relation],
        eps: p.eps,
      });
    }
  }
  return Array.from(personMap.values());
}

export interface UseSubjectDetailParams {
  subjectId: number;
  page: number;
  torrents: TorrentStatusInfo[];
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

export interface EpisodesPageData {
  items: BangumiEpisode[];
  total: number;
}

export function useSubjectDetail(
  params: UseSubjectDetailParams,
  deps: UseSubjectDetailDeps,
) {
  const { subjectId, page, torrents } = params;
  const {
    getBangumiSubjectUseCase,
    getBangumiEpisodesUseCase,
    getBangumiPersonsUseCase,
    getBangumiCharactersUseCase,
    openUrlUseCase,
    setTorrentSubjectUseCase,
    clearTorrentSubjectUseCase,
  } = deps;

  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { name?: string; imageUrl?: string } | null;
  const [, setSearchParams] = useSearchParams();
  const episodesSectionRef = useRef<HTMLDivElement>(null);
  const [pendingEpisode, setPendingEpisode] = useState<number | null>(null);

  const subjectQuery = useQuery(
    (ctx) =>
      getBangumiSubjectUseCase.execute(
        ctx,
        NonEmptyStringSchema.parse(String(subjectId)),
      ),
    [subjectId, getBangumiSubjectUseCase],
  );
  const subject = subjectQuery.data ?? undefined;

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

  const charactersQuery = useQuery<BangumiCharacter[]>(
    (ctx) =>
      getBangumiCharactersUseCase.execute(
        ctx,
        NonEmptyStringSchema.parse(String(subjectId)),
      ),
    [subjectId, getBangumiCharactersUseCase],
  );
  const characters = charactersQuery.data ?? [];

  const personsQuery = useQuery<BangumiPerson[]>(
    (ctx) =>
      getBangumiPersonsUseCase.execute(
        ctx,
        NonEmptyStringSchema.parse(String(subjectId)),
      ),
    [subjectId, getBangumiPersonsUseCase],
  );
  const persons = personsQuery.data ?? [];

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
    const name = subject.name_cn || subject.name;
    const epNum = String(episode.sort).padStart(2, "0");
    navigate(`/?keyword=${encodeURIComponent(`${name} ${epNum}`)}`);
    /* v8 ignore stop */
  };

  // v8 ignore start
  const handleBack = () => {
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        navigate(-1);
      });
    } else {
      navigate(-1);
    }
  };
  // v8 ignore stop

  const consolidatedStaff = useMemo(
    () => (persons.length > 0 ? consolidateStaff(persons) : []),
    [persons],
  );

  const boundResourcesCount = useMemo(
    () => torrents.filter((t) => t.subject_id === subjectId).length,
    [torrents, subjectId],
  );

  const boundTorrents = useMemo(
    () => torrents.filter((t) => t.subject_id === subjectId),
    [torrents, subjectId],
  );

  const unboundTorrents = useMemo(
    () => torrents.filter((t) => !t.subject_id),
    [torrents],
  );

  const staffGroupedByRole = useMemo(() => {
    const groups = new Map<string, ConsolidatedStaffMember[]>();
    for (const person of consolidatedStaff) {
      for (const relation of person.relations) {
        const list = groups.get(relation) || [];
        list.push(person);
        groups.set(relation, list);
      }
    }
    return groups;
  }, [consolidatedStaff]);

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
    setPendingEpisode(episodeNumber);
    changePage(targetPage);
  };

  const skipFirstScrollRef = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 依赖 page 以在翻页后滚动到列表顶部
  useEffect(() => {
    // v8 ignore start
    if (skipFirstScrollRef.current) {
      skipFirstScrollRef.current = false;
      return;
    }
    episodesSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    // v8 ignore stop
  }, [page]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 依赖 episodes 以在目标集渲染后触发 DOM 定位
  useEffect(() => {
    if (pendingEpisode == null) return;
    const target = episodesSectionRef.current?.querySelector(
      `[data-episode-sort="${pendingEpisode}"]`,
    );
    if (!target) return;
    // v8 ignore start
    (target as HTMLElement).scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    setPendingEpisode(null);
    // v8 ignore stop
  }, [pendingEpisode, episodes]);

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

  const displayName =
    subject?.name_cn || subject?.name || state?.name || "加载中...";
  const originalName = subject
    ? subject.name !== displayName
      ? subject.name
      : ""
    : "";
  const imageUrl = subject?.images?.large || state?.imageUrl;

  const handleOpenUrl = () => {
    // v8 ignore next
    if (!subject) return;
    void openUrlUseCase.execute(
      NonEmptyStringSchema.parse(`https://bgm.tv/subject/${subject.id}`),
    );
  };

  const bindMutation = useMutation(
    (_ctx, p: { infoHash: string }) =>
      setTorrentSubjectUseCase.execute({
        infoHash: NonEmptyStringSchema.parse(p.infoHash),
        subjectId,
        subjectName: NonEmptyStringSchema.parse(displayName),
      }),
    {
      onSuccess: () => toast.success("已绑定下载资源"),
      onError: (err) => toast.error(`绑定失败: ${formatError(err)}`),
    },
  );
  const handleBind = (infoHash: string) => bindMutation.execute({ infoHash });

  const unbindMutation = useMutation(
    (_ctx, p: { infoHash: NonEmptyString }) =>
      clearTorrentSubjectUseCase.execute(p.infoHash),
    {
      onSuccess: () => toast.success("已解除绑定"),
      onError: (err) => toast.error(`解绑失败: ${formatError(err)}`),
    },
  );
  const handleUnbind = (infoHash: NonEmptyString) =>
    unbindMutation.execute({ infoHash });

  return {
    subjectQuery,
    episodesQuery,
    charactersQuery,
    personsQuery,
    subject,
    episodes,
    totalEpisodes,
    totalPages,
    characters,
    persons,
    todayStr,
    consolidatedStaff,
    staffGroupedByRole,
    boundResourcesCount,
    boundTorrents,
    unboundTorrents,
    displayName,
    originalName,
    imageUrl,
    episodesSectionRef,
    handleBack,
    handleEpisodeClick,
    changePage,
    jumpToEpisode,
    handleOpenUrl,
    bindLoading: bindMutation.loading,
    unbindLoading: unbindMutation.loading,
    handleBind,
    handleUnbind,
  };
}

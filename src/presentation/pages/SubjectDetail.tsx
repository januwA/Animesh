import {
  ArrowLeft,
  Calendar,
  Clock,
  Globe,
  Loader2,
  Star,
  Tv,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import type {
  BangumiCharacter,
  BangumiEpisode,
  BangumiPerson,
} from "@/domain/bangumi/BangumiSchemas";
import { EpisodePaginationBar } from "@/presentation/components/EpisodePaginationBar";
import { FavoriteButton } from "@/presentation/components/FavoriteButton";
import { LazyImage } from "@/presentation/components/LazyImage";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/presentation/components/ui/tabs";
import { useQuery } from "@/presentation/hooks/useQuery";
import { ErrorState } from "../components/ErrorState";
import { InvalidParamsView } from "../components/InvalidParamsView";

/** Deduplicate staff by (id, relation), then group by person ID to collect all roles. */
function consolidateStaff(persons: BangumiPerson[]) {
  const seen = new Set<string>();
  const personMap = new Map<
    number,
    {
      id: number;
      name: string;
      image: string;
      relations: string[];
      eps: string;
    }
  >();

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

function CharacterCard({ character }: { character: BangumiCharacter }) {
  const mainActor = character.actors[0];

  const tvFallback = (
    <div className="w-full h-full flex items-center justify-center">
      <Tv className="h-8 w-8 text-muted-foreground/40" />
    </div>
  );

  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-all duration-200 hover:border-primary/30 hover:shadow-sm">
      {/* Character portrait */}
      <div className="relative aspect-3/4 bg-linear-to-b from-muted/50 to-muted overflow-hidden">
        <LazyImage
          src={character.images.large}
          alt={character.name}
          className="object-contain p-1 transition-transform duration-300 group-hover:scale-105"
          fallback={tvFallback}
        />
        {/* Relation badge overlay */}
        {character.relation && (
          <span
            className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] font-semibold rounded-full border ${character.relation === "主角" ? "bg-amber-500/90 text-white border-amber-400" : "bg-card/90 text-muted-foreground border-border"}`}
          >
            {character.relation} {/* style-ignore */}
          </span>
        )}
      </div>

      {/* Character info */}
      <div className="p-3 flex-1 flex flex-col gap-1">
        <h3 className="text-sm font-semibold leading-tight text-foreground line-clamp-1">
          {character.name}
        </h3>

        {/* Voice actor */}
        {mainActor && (
          <div className="mt-auto pt-2 border-t border-border/50">
            <p className="text-[11px] font-medium text-muted-foreground leading-tight truncate">
              CV: {mainActor.name}
            </p>
          </div>
        )}

        {/* Extra actors count */}
        {character.actors.length > 1 && (
          <p className="text-[10px] text-muted-foreground">
            +{character.actors.length - 1} 位声优
          </p>
        )}
      </div>
    </div>
  );
}

function StaffPersonBadge({
  person,
}: {
  person: ReturnType<typeof consolidateStaff>[number];
}) {
  return (
    <div className="px-3 py-1.5 rounded-lg bg-secondary/60 border border-border/50 text-sm transition-colors hover:bg-secondary">
      <span className="text-xs font-medium text-foreground">{person.name}</span>
      {person.eps && (
        <span className="text-[10px] text-muted-foreground">
          ({person.eps})
        </span>
      )}
    </div>
  );
}

function CharactersSkeleton() {
  return (
    <div
      className="flex overflow-x-auto gap-3 pb-2"
      data-testid="characters-skeleton"
    >
      {[0, 1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className="shrink-0 w-36 flex flex-col rounded-xl border border-border overflow-hidden"
        >
          <Skeleton className="aspect-3/4 rounded-none" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StaffSkeleton() {
  return (
    <div className="flex flex-col gap-4" data-testid="staff-skeleton">
      {[0, 1, 2, 3].map((n) => (
        <div key={n} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-7 w-20 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

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

const EPISODES_PAGE_SIZE = 50;

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
      subjectId={subjectResult.data.subjectId}
      page={Number(pageResult.data)}
    />
  );
}

function SubjectDetailView({
  subjectId,
  page,
}: {
  subjectId: string;
  page: number;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { name?: string; imageUrl?: string } | null;
  const [, setSearchParams] = useSearchParams();
  const episodesSectionRef = useRef<HTMLDivElement>(null);
  const [pendingEpisode, setPendingEpisode] = useState<number | null>(null);
  const {
    getBangumiSubjectUseCase,
    getBangumiEpisodesUseCase,
    getBangumiPersonsUseCase,
    getBangumiCharactersUseCase,
    openUrlUseCase,
  } = useDI();

  const subjectQuery = useQuery(
    (ctx) => getBangumiSubjectUseCase.execute(ctx, subjectId),
    [subjectId, getBangumiSubjectUseCase],
  );
  const subject = subjectQuery.data;

  const episodesQuery = useQuery(
    async (ctx) => {
      const data = await getBangumiEpisodesUseCase.execute(ctx, {
        subjectId,
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

  const charactersQuery = useQuery(
    (ctx) => getBangumiCharactersUseCase.execute(ctx, subjectId),
    [subjectId, getBangumiCharactersUseCase],
  );
  const characters = charactersQuery.data ?? [];

  const personsQuery = useQuery(
    (ctx) => getBangumiPersonsUseCase.execute(ctx, subjectId),
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
    /* v8 ignore next */
    if (!subject) return;
    const name = subject.name_cn || subject.name;
    const epNum = String(episode.sort).padStart(2, "0");
    navigate(`/?keyword=${encodeURIComponent(`${name} ${epNum}`)}`);
  };

  const handleBack = () => {
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        navigate(-1);
      });
    } else {
      navigate(-1);
    }
  };

  const consolidatedStaff = useMemo(
    () => (persons.length > 0 ? consolidateStaff(persons) : []),
    [persons],
  );

  const staffGroupedByRole = useMemo(() => {
    const groups = new Map<string, typeof consolidatedStaff>();
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
    if (skipFirstScrollRef.current) {
      skipFirstScrollRef.current = false;
      return;
    }
    episodesSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [page]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 依赖 episodes 以在目标集渲染后触发 DOM 定位
  useEffect(() => {
    if (pendingEpisode == null) return;
    const target = episodesSectionRef.current?.querySelector(
      `[data-episode-sort="${pendingEpisode}"]`,
    );
    if (!target) return;
    (target as HTMLElement).scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    setPendingEpisode(null);
  }, [pendingEpisode, episodes]);

  useEffect(() => {
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
  }, [
    page,
    totalPages,
    episodesQuery.loading,
    episodesQuery.data,
    setSearchParams,
  ]);

  if (subjectQuery.error) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <ErrorState
          title="获取动漫详情失败"
          message={subjectQuery.error}
          onRetry={subjectQuery.refetch}
        />
      </div>
    );
  }

  const displayName =
    subject?.name_cn || subject?.name || state?.name || "加载中...";
  const originalName = subject
    ? subject.name !== displayName
      ? subject.name
      : ""
    : "";
  const imageUrl = subject?.images?.large || state?.imageUrl;

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>

        <div className="flex items-center gap-1">
          {subject && (
            <FavoriteButton
              subject={{
                subjectId: subject.id,
                name: subject.name_cn || subject.name,
                imageUrl: subject.images?.large ?? null,
              }}
              showLabel={false}
            />
          )}
          {subject && (
            <a
              href={`https://bgm.tv/subject/${subject.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors px-2.5 py-1 rounded bg-secondary hover:bg-accent"
              onClick={async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const url = `https://bgm.tv/subject/${subject.id}`;
                await openUrlUseCase.execute(url);
              }}
              title={`在 Bangumi 打开: ${displayName}`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>详情</span>
            </a>
          )}
        </div>
      </div>

      {/* Info Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Poster Image */}
        <div className="w-full md:w-48 shrink-0 flex justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={displayName}
              style={
                {
                  viewTransitionName: `anime-cover-${subjectId}`,
                } as React.CSSProperties
              }
              className="w-48 aspect-3/4 object-cover rounded-xl shadow-lg border border-border"
            />
          ) : (
            <div className="w-48 aspect-3/4 rounded-xl bg-muted flex items-center justify-center border border-border">
              <Tv className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Title and Metadata */}
        <div className="flex-1 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-2">
            {!subject ? (
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {subject.platform && (
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-secondary border border-border text-muted-foreground"
                  >
                    <Tv className="h-3 w-3" />
                    {subject.platform}
                  </Badge>
                )}
                {subject.date && (
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-secondary border border-border text-muted-foreground"
                  >
                    <Calendar className="h-3 w-3" />
                    {subject.date}
                  </Badge>
                )}
                <Badge
                  variant="secondary"
                  className="gap-1 bg-secondary border border-border text-muted-foreground"
                >
                  <Clock className="h-3 w-3" />共 {subject.eps || "??"} 话
                </Badge>
              </div>
            )}

            <h1 className="text-xl md:text-3xl font-bold tracking-tight text-foreground">
              {displayName}
            </h1>
            {originalName && (
              <p className="text-sm md:text-base text-muted-foreground italic font-normal">
                {originalName}
              </p>
            )}
          </div>

          {/* Ratings / Stats / Loading Status */}
          {!subject ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                <span>正在加载动漫详情...</span>
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-20 w-28 rounded-lg" />
                <Skeleton className="h-20 w-28 rounded-lg" />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-6 items-center pt-2">
              {subject.rating && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    {" "}
                    {/* style-ignore */}
                    <Star className="h-6 w-6 fill-current" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-amber-500">
                      {subject.rating.score.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {subject.rating.total?.toLocaleString() ?? 0} 人评分
                    </div>
                  </div>
                </div>
              )}

              {subject.rating?.rank ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary border border-primary/20">
                    <Tv className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-primary">
                      Rank #{subject.rating.rank}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Bangumi 排名
                    </div>
                  </div>
                </div>
              ) : null}

              {subject.collection?.doing != null && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                    {" "}
                    {/* style-ignore */}
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-green-500">
                      {subject.collection.doing.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">人在看</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Episodes List */}
      <div className="flex flex-col gap-4" ref={episodesSectionRef}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">剧集列表</h2>
          {totalEpisodes > 0 && (
            <span className="text-xs text-muted-foreground">
              共 {totalEpisodes} 集
            </span>
          )}
        </div>

        {episodesQuery.error ? (
          <ErrorState
            title="获取剧集列表失败"
            message={episodesQuery.error}
            onRetry={episodesQuery.refetch}
          />
        ) : episodesQuery.loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Skeleton key={n} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : episodes.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {episodes.map((ep) => {
                const isAired = ep.airdate ? todayStr >= ep.airdate : false;
                return (
                  <button
                    key={ep.id}
                    type="button"
                    data-episode-sort={ep.sort}
                    onClick={() => handleEpisodeClick(ep)}
                    className={`group text-left flex items-start gap-3 p-3 rounded-xl transition-all duration-200 ${
                      isAired
                        ? "bg-primary/5 border border-primary/20 hover:border-primary/30 hover:bg-primary/10"
                        : "bg-card border border-border hover:border-primary/30 hover:bg-muted/30"
                    }`}
                  >
                    <div
                      className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                        isAired
                          ? "bg-primary/15 group-hover:bg-primary/25"
                          : "bg-muted group-hover:bg-primary/10"
                      }`}
                    >
                      <span
                        className={`text-sm font-bold transition-colors ${
                          isAired
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-primary"
                        }`}
                      >
                        {String(ep.sort).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 justify-between">
                        <h3 className="text-sm font-medium leading-tight text-foreground group-hover:text-primary transition-colors">
                          {ep.name_cn || ep.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {ep.duration && <span>时长 {ep.duration}</span>}
                        {ep.airdate && <span>首播 {ep.airdate}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {totalPages > 1 && (
              <EpisodePaginationBar
                page={page}
                totalPages={totalPages}
                total={totalEpisodes}
                onPageChange={changePage}
                onJumpToEpisode={jumpToEpisode}
              />
            )}
          </>
        ) : (
          <Empty className="py-12">
            <EmptyContent>
              <EmptyTitle>暂无剧集数据</EmptyTitle>
            </EmptyContent>
          </Empty>
        )}
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList
          variant="line"
          className="w-full justify-start gap-6 bg-transparent rounded-none h-auto p-0 border-b border-border"
        >
          <TabsTrigger
            value="summary"
            className="flex-1 sm:flex-none px-0 pb-2 rounded-none bg-transparent text-sm font-semibold after:opacity-0 data-active:after:opacity-100 data-active:bg-transparent dark:data-active:bg-transparent"
          >
            简介
          </TabsTrigger>
          <TabsTrigger
            value="characters"
            className="flex-1 sm:flex-none px-0 pb-2 rounded-none bg-transparent text-sm font-semibold after:opacity-0 data-active:after:opacity-100 data-active:bg-transparent dark:data-active:bg-transparent"
          >
            角色
            {characters.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 text-xs border-border text-muted-foreground"
              >
                {characters.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="staff"
            className="flex-1 sm:flex-none px-0 pb-2 rounded-none bg-transparent text-sm font-semibold after:opacity-0 data-active:after:opacity-100 data-active:bg-transparent dark:data-active:bg-transparent"
          >
            制作人员
            {persons.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 text-xs border-border text-muted-foreground"
              >
                {consolidatedStaff.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="pt-4">
          {!subject ? (
            <Card className="bg-card border border-border rounded-xl">
              <CardContent className="p-6 space-y-2">
                <Skeleton className="h-4 w-20" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border border-border rounded-xl">
              <CardContent className="p-6 flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  剧情简介
                </h2>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {subject.summary}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="characters" className="pt-4">
          {charactersQuery.error ? (
            <ErrorState
              title="获取角色数据失败"
              message={charactersQuery.error}
              onRetry={charactersQuery.refetch}
            />
          ) : charactersQuery.loading ? (
            <CharactersSkeleton />
          ) : characters.length > 0 ? (
            <div className="flex overflow-x-auto gap-3 pb-2 snap-x scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent -mx-1 px-1">
              {characters.map((char) => (
                <div key={char.id} className="snap-start shrink-0 w-36">
                  <CharacterCard character={char} />
                </div>
              ))}
            </div>
          ) : (
            <Empty className="py-8">
              <EmptyContent>
                <EmptyTitle>暂无角色数据</EmptyTitle>
              </EmptyContent>
            </Empty>
          )}
        </TabsContent>

        <TabsContent value="staff" className="pt-4">
          {personsQuery.error ? (
            <ErrorState
              title="获取制作人员数据失败"
              message={personsQuery.error}
              onRetry={personsQuery.refetch}
            />
          ) : personsQuery.loading ? (
            <StaffSkeleton />
          ) : staffGroupedByRole.size > 0 ? (
            <div className="flex flex-col gap-5">
              {Array.from(staffGroupedByRole.entries()).map(
                ([role, people]) => (
                  <div key={role} className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {role}
                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground/60">
                        {people.length}
                      </span>
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {people.map((person) => (
                        <StaffPersonBadge
                          key={`${person.id}-${role}`}
                          person={person}
                        />
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : (
            <Empty className="py-8">
              <EmptyContent>
                <EmptyTitle>暂无制作人员数据</EmptyTitle>
              </EmptyContent>
            </Empty>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { ErrorState } from "@/presentation/components/ErrorState";
import {
  Empty,
  EmptyContent,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/presentation/components/ui/tooltip";
import { EpisodePaginationBar } from "./EpisodePaginationBar";
import type { UseSubjectEpisodesDeps } from "./useSubjectEpisodes";
import { useSubjectEpisodes } from "./useSubjectEpisodes";

export interface EpisodesSectionProps {
  subjectId: number;
  page: number;
  subject: AnimeSubject | undefined;
  deps: UseSubjectEpisodesDeps;
}

export function EpisodesSection({
  subjectId,
  page,
  subject,
  deps,
}: EpisodesSectionProps) {
  const r = useSubjectEpisodes({ subjectId, page, subject }, deps);
  const { episodes, totalEpisodes, totalPages, todayStr } = r;
  const loading = r.episodesQuery.loading;
  const error = r.episodesQuery.error;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">剧集列表</h2>
        {totalEpisodes > 0 && (
          <span className="text-xs text-muted-foreground">
            共 {totalEpisodes} 集
          </span>
        )}
      </div>

      {error ? (
        <ErrorState
          title="获取剧集列表失败"
          message={error}
          onRetry={r.episodesQuery.refetch}
        />
      ) : loading ? (
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 可行
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : episodes.length > 0 ? (
        <>
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
            {episodes.map((ep) => {
              // v8 ignore next
              const isAired = ep.airdate ? todayStr >= ep.airdate : false;
              return (
                <Tooltip key={ep.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => r.handleEpisodeClick(ep)}
                      className={`group h-9 w-full rounded-lg flex items-center justify-center transition-all duration-200 ${
                        isAired
                          ? "bg-primary/5 border border-primary/20 hover:border-primary/30 hover:bg-primary/10"
                          : "bg-card border border-border hover:border-primary/30 hover:bg-muted/30"
                      }`}
                    >
                      <span
                        className={`text-xs font-bold transition-colors ${
                          isAired
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-primary"
                        }`}
                      >
                        {String(ep.sort).padStart(2, "0")}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span>{ep.name}</span>
                    {ep.airdate && (
                      <span className="text-muted-foreground">
                        首播 {ep.airdate}
                      </span>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          {totalPages > 1 && (
            <EpisodePaginationBar
              page={page}
              totalPages={totalPages}
              total={totalEpisodes}
              onPageChange={r.changePage}
              onJumpToEpisode={r.jumpToEpisode}
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
  );
}

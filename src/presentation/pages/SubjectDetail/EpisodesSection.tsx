import type { RefObject } from "react";
import type { BangumiEpisode } from "@/domain/bangumi/BangumiSchemas";
import { EpisodePaginationBar } from "@/presentation/components/EpisodePaginationBar";
import { ErrorState } from "@/presentation/components/ErrorState";
import {
  Empty,
  EmptyContent,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { Skeleton } from "@/presentation/components/ui/skeleton";

export interface EpisodesSectionProps {
  sectionRef: RefObject<HTMLDivElement | null>;
  episodes: BangumiEpisode[];
  totalEpisodes: number;
  totalPages: number;
  page: number;
  todayStr: string;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onEpisodeClick: (episode: BangumiEpisode) => void;
  onPageChange: (page: number) => void;
  onJumpToEpisode: (episodeNumber: number) => void;
}

export function EpisodesSection({
  sectionRef,
  episodes,
  totalEpisodes,
  totalPages,
  page,
  todayStr,
  loading,
  error,
  onRetry,
  onEpisodeClick,
  onPageChange,
  onJumpToEpisode,
}: EpisodesSectionProps) {
  return (
    <div className="flex flex-col gap-4" ref={sectionRef}>
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
          onRetry={onRetry}
        />
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Skeleton key={n} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : episodes.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {episodes.map((ep) => {
              // v8 ignore next
              const isAired = ep.airdate ? todayStr >= ep.airdate : false;
              return (
                <button
                  key={ep.id}
                  type="button"
                  data-episode-sort={ep.sort}
                  onClick={() => onEpisodeClick(ep)}
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
              onPageChange={onPageChange}
              onJumpToEpisode={onJumpToEpisode}
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

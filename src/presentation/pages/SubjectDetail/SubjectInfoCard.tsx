import { Calendar, Clock, Loader2, Star, Tv } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { BangumiSubject } from "@/domain/bangumi/BangumiSchemas";
import { Skeleton } from "@/presentation/components/ui/skeleton";

export interface SubjectInfoCardProps {
  subject: BangumiSubject | undefined;
  subjectId: number;
  displayName: string;
  imageUrl: string | undefined;
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary/60 px-3 py-2.5">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground truncate">
          {value}
        </div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export function SubjectInfoCard({
  subject,
  subjectId,
  displayName,
  imageUrl,
}: SubjectInfoCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      {/* 背景层：海报模糊 + 渐变遮罩 */}
      {imageUrl ? (
        <div aria-hidden className="absolute inset-0">
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover blur-1xl scale-110"
          />
          <div className="absolute inset-0 bg-card/60" />
          <div className="absolute inset-0 bg-linear-to-t from-card via-card/60 to-card/40" />
        </div>
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-br from-primary/5 via-card to-accent/10"
        />
      )}

      {/* 内容层 */}
      <div className="relative p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Poster Image */}
        <div className="w-full md:w-48 shrink-0 flex justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={displayName}
              style={
                {
                  viewTransitionName: `anime-cover-${subjectId}`,
                } as CSSProperties
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
            {!subject && (
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            )}

            <h1 className="text-xl md:text-3xl font-bold tracking-tight text-foreground">
              {displayName}
            </h1>
          </div>

          {/* Stats / Loading Status */}
          {!subject ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                <span>正在加载动漫详情...</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary/60 px-3 py-2.5">
                  <Star className="h-4 w-4 shrink-0 fill-current text-amber-500" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-amber-500">
                      {subject.rating.toFixed(1)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      评分
                    </div>
                  </div>
                </div>

                {subject.eps != null && (
                  <StatItem
                    icon={<Clock className="h-4 w-4" />}
                    label="话数"
                    value={`共 ${subject.eps} 话`}
                  />
                )}
                {subject.date && (
                  <StatItem
                    icon={<Calendar className="h-4 w-4" />}
                    label="首播"
                    value={subject.date}
                  />
                )}
                {subject.platform && (
                  <StatItem
                    icon={<Tv className="h-4 w-4" />}
                    label="平台"
                    value={subject.platform}
                  />
                )}
              </div>

              {subject.summary && (
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {subject.summary}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

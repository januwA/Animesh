import { Calendar, Clock, Loader2, Star, Tv } from "lucide-react";
import type { CSSProperties } from "react";
import type { BangumiSubject } from "@/domain/bangumi/BangumiSchemas";
import { Badge } from "@/presentation/components/ui/badge";
import { Skeleton } from "@/presentation/components/ui/skeleton";

export interface SubjectInfoCardProps {
  subject: BangumiSubject | undefined;
  subjectId: number;
  displayName: string;
  imageUrl: string | undefined;
}

export function SubjectInfoCard({
  subject,
  subjectId,
  displayName,
  imageUrl,
}: SubjectInfoCardProps) {
  return (
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
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                {" "}
                {/* style-ignore */}
                <Star className="h-6 w-6 fill-current" />
              </div>
              <div>
                <div className="text-xl font-bold text-amber-500">
                  {subject.rating.toFixed(1)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

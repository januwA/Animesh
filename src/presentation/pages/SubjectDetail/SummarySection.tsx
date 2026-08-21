import type { BangumiSubject } from "@/domain/bangumi/BangumiSchemas";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { Skeleton } from "@/presentation/components/ui/skeleton";

export interface SummarySectionProps {
  subject: BangumiSubject | undefined;
}

export function SummarySection({ subject }: SummarySectionProps) {
  if (!subject) {
    return (
      <Card className="ani-card">
        <CardContent className="p-6 space-y-2">
          <Skeleton className="h-4 w-20" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="ani-card">
      <CardContent className="p-6 flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          剧情简介
        </h2>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {subject.summary}
        </p>
      </CardContent>
    </Card>
  );
}

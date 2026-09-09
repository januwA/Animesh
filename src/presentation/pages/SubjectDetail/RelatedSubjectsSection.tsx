import { useNavigate } from "react-router-dom";
import type { GetRelatedSubjectsUseCase } from "@/application/anime/GetRelatedSubjectsUseCase";
import type {
  AnimePlatform,
  AnimeRelatedSubject,
} from "@/domain/anime/AnimeSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import { ErrorState } from "@/presentation/components/ErrorState";
import { MediaCard } from "@/presentation/components/MediaCard";
import {
  Empty,
  EmptyContent,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import { useQuery } from "@/presentation/hooks/useQuery";

export interface RelatedSubjectsSectionProps {
  subjectId: number;
  platform: AnimePlatform;
  getRelatedSubjectsUseCase: Pick<GetRelatedSubjectsUseCase, "execute">;
}

export function RelatedSubjectsSection({
  subjectId,
  platform,
  getRelatedSubjectsUseCase,
}: RelatedSubjectsSectionProps) {
  const navigate = useNavigate();

  const query = useQuery<AnimeRelatedSubject[]>(
    (ctx) =>
      getRelatedSubjectsUseCase.execute(
        ctx,
        NonEmptyStringSchema.parse(String(subjectId)),
      ),
    [subjectId, getRelatedSubjectsUseCase],
  );

  const relatedSubjects = query.data ?? [];

  if (query.error) {
    return (
      <ErrorState
        title="获取关联条目失败"
        message={query.error}
        onRetry={query.refetch}
      />
    );
  }

  if (query.loading) {
    return (
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
        data-testid="related-subjects-skeleton"
      >
        {[0, 1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="flex flex-col rounded-xl border border-border overflow-hidden"
          >
            <Skeleton className="aspect-3/4 rounded-none" />
            <div className="p-2 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (relatedSubjects.length === 0) {
    return (
      <Empty className="py-8">
        <EmptyContent>
          <EmptyTitle>暂无关联网目</EmptyTitle>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {relatedSubjects.map((item) => (
        <div key={item.id} className="relative">
          <MediaCard
            id={item.id}
            imageSrc={item.image}
            title={item.name}
            onClick={() =>
              navigate(`/anime/subject/${item.id}?platform=${platform}`, {
                viewTransition: true,
                state: { name: item.name, imageUrl: item.image },
              })
            }
          />
          {item.relation && (
            <span className="absolute top-1 left-1 z-10 px-1.5 py-0.5 text-[10px] font-medium bg-primary/90 text-primary-foreground rounded-md backdrop-blur-sm">
              {item.relation}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

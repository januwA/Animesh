import type { BangumiCharacter } from "@/domain/bangumi/BangumiSchemas";
import { ErrorState } from "@/presentation/components/ErrorState";
import {
  Empty,
  EmptyContent,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import { CharacterCard } from "./CharacterCard";

export interface CharactersSectionProps {
  characters: BangumiCharacter[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

export function CharactersSection({
  characters,
  loading,
  error,
  onRetry,
}: CharactersSectionProps) {
  if (error) {
    return (
      <ErrorState title="获取角色数据失败" message={error} onRetry={onRetry} />
    );
  }

  if (loading) {
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

  if (characters.length === 0) {
    return (
      <Empty className="py-8">
        <EmptyContent>
          <EmptyTitle>暂无角色数据</EmptyTitle>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex overflow-x-auto gap-3 pb-2 snap-x scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent -mx-1 px-1">
      {characters.map((char) => (
        <div key={char.id} className="snap-start shrink-0 w-36">
          <CharacterCard character={char} />
        </div>
      ))}
    </div>
  );
}

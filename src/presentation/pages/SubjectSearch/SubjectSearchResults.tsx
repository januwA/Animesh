import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { MediaCard } from "@/presentation/components/MediaCard";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { InfiniteScrollTrigger } from "../../components/InfiniteScrollTrigger";

interface SubjectSearchResultsProps {
  items: AnimeSubject[];
  onSubjectClick: (item: AnimeSubject) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function SubjectSearchResults({
  items,
  onSubjectClick,
  hasMore,
  loadingMore,
  onLoadMore,
  emptyTitle = "未找到相关条目",
  emptyDescription = "换个关键词试试",
}: SubjectSearchResultsProps) {
  if (items.length === 0) {
    return (
      <Empty>
        <EmptyContent>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            id={item.id}
            imageSrc={item.image}
            title={item.name}
            rating={item.rating}
            onClick={() => onSubjectClick(item)}
          />
        ))}
      </div>
      <InfiniteScrollTrigger
        hasMore={hasMore}
        loading={loadingMore}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}

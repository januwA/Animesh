import { Star } from "lucide-react";
import type { BangumiCalendarItem } from "@/domain/bangumi/BangumiSchemas";
import { LazyImage } from "@/presentation/components/LazyImage";

interface AnimeCardProps {
  item: BangumiCalendarItem;
  onClick: () => void;
}

export function AnimeCard({ item, onClick }: AnimeCardProps) {
  return (
    <div className="group flex flex-col bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-all duration-200 text-left relative">
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col flex-1 w-full text-left"
        title={`详情: ${item.name}`}
      >
        <div className="aspect-3/4 w-full overflow-hidden bg-muted">
          <LazyImage
            src={item.image}
            alt={item.name}
            style={
              {
                viewTransitionName: `anime-cover-${item.id}`,
              } as React.CSSProperties
            }
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>

        <div className="p-2 flex flex-col gap-1 flex-1 w-full">
          <h3 className="text-xs font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {item.name}
          </h3>

          <div className="flex items-center gap-2 mt-auto pt-1">
            <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
              <Star className="h-2.5 w-2.5 fill-current" />
              {item.rating.toFixed(1)}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

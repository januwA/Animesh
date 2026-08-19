import { Tv } from "lucide-react";
import type { FavoriteItem } from "@/domain/collection/CollectionSchemas";
import { LazyImage } from "@/presentation/components/LazyImage";
import { Card } from "@/presentation/components/ui/card";

interface CollectionCardProps {
  item: FavoriteItem;
  onClick: () => void;
}

export function CollectionCard({ item, onClick }: CollectionCardProps) {
  return (
    <Card className="py-0 group overflow-hidden hover:border-primary/30 transition-all duration-200">
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col flex-1 w-full text-left"
        title={`详情: ${item.name}`}
      >
        {item.imageUrl ? (
          <div className="aspect-3/4 w-full overflow-hidden bg-muted">
            <LazyImage
              src={item.imageUrl}
              alt={item.name}
              style={
                {
                  viewTransitionName: `anime-cover-${item.subjectId}`,
                } as React.CSSProperties
              }
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="aspect-3/4 w-full bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <Tv className="h-8 w-8 text-primary/30" />
          </div>
        )}

        <div className="p-2 flex flex-col gap-1 flex-1 w-full">
          <h3 className="text-xs font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {item.name}
          </h3>
        </div>
      </button>
    </Card>
  );
}

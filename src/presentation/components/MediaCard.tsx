import { Star, Tv } from "lucide-react";
import { LazyImage } from "@/presentation/components/LazyImage";
import { Card } from "@/presentation/components/ui/card";

interface MediaCardProps {
  id: number;
  imageSrc: string | null;
  title: string;
  rating?: number;
  onClick: () => void;
}

export function MediaCard({
  id,
  imageSrc,
  title,
  rating,
  onClick,
}: MediaCardProps) {
  return (
    <Card className="py-0 group overflow-hidden hover:ring-primary/30 transition-all duration-200">
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col flex-1 w-full text-left"
        title={`详情: ${title}`}
      >
        {imageSrc ? (
          <div className="aspect-3/4 w-full overflow-hidden bg-muted">
            <LazyImage
              src={imageSrc}
              alt={title}
              style={
                {
                  viewTransitionName: `anime-cover-${id}`,
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
            {title}
          </h3>

          {rating !== undefined && (
            <div className="flex items-center gap-2 mt-auto pt-1">
              <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                <Star className="h-2.5 w-2.5 fill-current" />
                {rating.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </button>
    </Card>
  );
}

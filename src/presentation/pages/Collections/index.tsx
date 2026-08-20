import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyTitle,
} from "@/presentation/components/ui/empty";
import { CollectionCard } from "./CollectionCard";
import { useCollectionsPage } from "./useCollectionsPage";

export default function Collections() {
  const { getCollectionsUseCase } = useDI();
  const { items, handleItemClick } = useCollectionsPage({
    getCollectionsUseCase,
  });

  return (
    <div className="w-full flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <Heart className="h-5 w-5 text-red-500 fill-current" />
        <h1 className="text-lg font-bold text-foreground">我的收藏</h1>
        {items.length > 0 && (
          <Badge
            variant="secondary"
            className="text-xs border-border text-muted-foreground"
          >
            {items.length}
          </Badge>
        )}
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {items.map((item) => (
            <CollectionCard
              key={item.subjectId}
              item={item}
              onClick={() => handleItemClick(item)}
            />
          ))}
        </div>
      ) : (
        <Empty>
          <EmptyContent>
            <EmptyTitle>还没有收藏任何条目</EmptyTitle>
          </EmptyContent>
          <Button variant="outline" size="sm" asChild>
            <Link to="/calendar">去新番日历看看</Link>
          </Button>
        </Empty>
      )}
    </div>
  );
}

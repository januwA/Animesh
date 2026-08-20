import { Heart } from "lucide-react";
import { useState } from "react";
import type { AddFavoriteUseCase } from "@/application/collection/AddFavoriteUseCase";
import type { GetFavoriteStatusUseCase } from "@/application/collection/GetFavoriteStatusUseCase";
import type { RemoveFavoriteUseCase } from "@/application/collection/RemoveFavoriteUseCase";
import type { BangumiSubject } from "@/domain/bangumi/BangumiSchemas";
import { Button } from "@/presentation/components/ui/button";
import { useQuery } from "@/presentation/hooks/useQuery";
import { useCollectionsStore } from "@/presentation/store/collectionsStore";

interface FavoriteButtonProps {
  subject: BangumiSubject;
  showLabel?: boolean;
  getFavoriteStatusUseCase: Pick<GetFavoriteStatusUseCase, "execute">;
  addFavoriteUseCase: Pick<AddFavoriteUseCase, "execute">;
  removeFavoriteUseCase: Pick<RemoveFavoriteUseCase, "execute">;
}

export function FavoriteButton({
  subject,
  showLabel = true,
  getFavoriteStatusUseCase,
  addFavoriteUseCase,
  removeFavoriteUseCase,
}: FavoriteButtonProps) {
  const { data, loading, refetch } = useQuery(
    () => getFavoriteStatusUseCase.execute(subject.id),
    [getFavoriteStatusUseCase, subject.id],
    {
      onSuccess: () => setOptimistic(null),
    },
  );
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const favorited = optimistic ?? data ?? false;
  const ready = !loading;

  const addItem = useCollectionsStore((s) => s.addItem);
  const removeItem = useCollectionsStore((s) => s.removeItem);

  const handleClick = async () => {
    const next = !favorited;
    setOptimistic(next);
    if (next) {
      await addFavoriteUseCase.execute({
        subjectId: subject.id,
        name: subject.name,
        imageUrl: subject.image,
      });
      addItem({
        subjectId: subject.id,
        name: subject.name,
        imageUrl: subject.image,
      });
    } else {
      await removeFavoriteUseCase.execute(subject.id);
      removeItem(subject.id);
    }
    refetch();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      aria-label={ready ? (favorited ? "已收藏" : "收藏") : "收藏"}
      // style-ignore
      className={`gap-1.5 transition-all ${
        favorited
          ? "text-red-500 hover:text-red-600 hover:bg-red-500/10"
          : "text-muted-foreground hover:text-foreground"
      }`}
      title={favorited ? "取消收藏" : "添加收藏"}
    >
      <Heart
        className={`h-4 w-4 transition-all ${favorited ? "fill-current" : ""}`}
      />
      {showLabel && (
        <span className="text-xs">
          {ready ? (favorited ? "已收藏" : "收藏") : "收藏"}
        </span>
      )}
    </Button>
  );
}

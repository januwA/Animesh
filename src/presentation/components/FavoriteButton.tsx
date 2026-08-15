import { Heart } from "lucide-react";
import { useState } from "react";
import { useDI } from "@/di/DIContext";
import { useQuery } from "@/presentation/hooks/useQuery";
import { Button } from "./ui/button";

export interface FavoriteButtonSubject {
  subjectId: number;
  name: string;
  imageUrl: string | null;
}

interface FavoriteButtonProps {
  subject: FavoriteButtonSubject;
  showLabel?: boolean;
}

export function FavoriteButton({
  subject,
  showLabel = true,
}: FavoriteButtonProps) {
  const {
    getFavoriteStatusUseCase,
    addFavoriteUseCase,
    removeFavoriteUseCase,
  } = useDI();

  const { data, loading, refetch } = useQuery(
    () => getFavoriteStatusUseCase.execute(subject.subjectId),
    [getFavoriteStatusUseCase, subject.subjectId],
    {
      onSuccess: () => setOptimistic(null),
    },
  );
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const favorited = optimistic ?? data ?? false;
  const ready = !loading;

  const handleClick = async () => {
    const next = !favorited;
    setOptimistic(next);
    if (next) {
      await addFavoriteUseCase.execute({
        subjectId: subject.subjectId,
        name: subject.name,
        imageUrl: subject.imageUrl,
      });
    } else {
      await removeFavoriteUseCase.execute(subject.subjectId);
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

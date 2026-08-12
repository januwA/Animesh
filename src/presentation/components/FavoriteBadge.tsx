import { Heart } from "lucide-react";
import { useDI } from "@/di/DIContext";
import { useQuery } from "@/presentation/hooks/useQuery";

interface FavoriteBadgeProps {
  subjectId: number;
}

export function FavoriteBadge({ subjectId }: FavoriteBadgeProps) {
  const { collectionRepository } = useDI();
  const { data: favorited } = useQuery(
    () => collectionRepository.isFavorited(subjectId),
    [collectionRepository, subjectId],
  );

  if (!favorited) {
    return null;
  }

  return (
    // style-ignore
    <div className="absolute top-2 right-2 z-10 flex items-center justify-center h-6 w-6 rounded-full bg-red-500/80 backdrop-blur-xs shadow-xs">
      <Heart className="h-3 w-3 fill-white text-white" />
    </div>
  );
}

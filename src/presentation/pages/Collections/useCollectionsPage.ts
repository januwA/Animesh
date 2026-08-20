import { useNavigate } from "react-router-dom";
import type { GetCollectionsUseCase } from "@/application/collection/GetCollectionsUseCase";
import { useQuery } from "@/presentation/hooks/useQuery";
import { useCollectionsStore } from "@/presentation/store/collectionsStore";

export interface UseCollectionsPageDeps {
  getCollectionsUseCase: Pick<GetCollectionsUseCase, "execute">;
}

export function useCollectionsPage(deps: UseCollectionsPageDeps) {
  const { getCollectionsUseCase } = deps;
  const navigate = useNavigate();
  const items = useCollectionsStore((s) => s.items);
  const setItems = useCollectionsStore((s) => s.setItems);

  useQuery(() => getCollectionsUseCase.execute(), [getCollectionsUseCase], {
    onSuccess: setItems,
  });

  const handleItemClick = (item: {
    subjectId: number;
    name: string;
    imageUrl: string | null;
  }) => {
    navigate(`/subject/${item.subjectId}`, {
      viewTransition: true,
      state: {
        name: item.name,
        imageUrl: item.imageUrl,
      },
    });
  };

  return {
    items,
    handleItemClick,
  };
}

import { useNavigate } from "react-router-dom";
import type { GetCollectionsUseCase } from "@/application/collection/GetCollectionsUseCase";
import { useQuery } from "@/presentation/hooks/useQuery";

export interface UseCollectionsPageDeps {
  getCollectionsUseCase: Pick<GetCollectionsUseCase, "execute">;
}

export function useCollectionsPage(deps: UseCollectionsPageDeps) {
  const { getCollectionsUseCase } = deps;
  const navigate = useNavigate();
  const { data } = useQuery(
    () => getCollectionsUseCase.execute(),
    [getCollectionsUseCase],
  );
  const items = data ?? [];

  const handleNavigateToCalendar = () => {
    navigate("/calendar");
  };

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
    handleNavigateToCalendar,
    handleItemClick,
  };
}

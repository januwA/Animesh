import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { GetNextSeasonAnimeUseCase } from "@/application/anime/GetNextSeasonAnimeUseCase";
import type {
  AnimeCalendarItem,
  NextSeasonData,
} from "@/domain/anime/AnimeSchemas";
import { useQuery } from "@/presentation/hooks/useQuery";

export interface UseNextSeasonPageDeps {
  getNextSeasonUseCase: Pick<GetNextSeasonAnimeUseCase, "execute">;
}

export function useNextSeasonPage(
  deps: UseNextSeasonPageDeps,
  useDataStore: <U>(
    selector: (state: {
      data: NextSeasonData;
      setData: (val: NextSeasonData) => void;
    }) => U,
  ) => U,
  subjectPath: (id: number) => string,
) {
  const { getNextSeasonUseCase } = deps;
  const navigate = useNavigate();
  const data = useDataStore((s) => s.data);
  const setData = useDataStore((s) => s.setData);

  const {
    loading: isLoading,
    error,
    refetch,
  } = useQuery(
    (ctx) => getNextSeasonUseCase.execute(ctx),
    [getNextSeasonUseCase, data.length, setData],
    {
      enabled: data.length === 0,
      onSuccess: (result) => {
        setData(result.data);
      },
    },
  );

  const handleAnimeClick = useCallback(
    (item: AnimeCalendarItem) => {
      navigate(subjectPath(item.id), {
        viewTransition: true,
        state: {
          name: item.name,
          imageUrl: item.image,
        },
      });
    },
    [navigate, subjectPath],
  );

  return {
    data,
    isLoading,
    error,
    refetch,
    handleAnimeClick,
  };
}

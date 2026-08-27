import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { GetNextSeasonAnimeUseCase } from "@/application/anime/GetNextSeasonAnimeUseCase";
import type { AnimeCalendarItem } from "@/domain/anime/AnimeSchemas";
import { useQuery } from "@/presentation/hooks/useQuery";
import { useNextSeasonStore } from "../../store/nextSeasonStore";

export interface UseNextSeasonPageDeps {
  getBangumiNextSeasonUseCase: Pick<GetNextSeasonAnimeUseCase, "execute">;
}

export function useNextSeasonPage(deps: UseNextSeasonPageDeps) {
  const { getBangumiNextSeasonUseCase } = deps;
  const navigate = useNavigate();
  const data = useNextSeasonStore((s) => s.data);
  const setData = useNextSeasonStore((s) => s.setData);

  const {
    loading: isLoading,
    error,
    refetch,
  } = useQuery(
    (ctx) => getBangumiNextSeasonUseCase.execute(ctx),
    [getBangumiNextSeasonUseCase, data.length, setData],
    {
      enabled: data.length === 0,
      onSuccess: (result) => {
        setData(result.data);
      },
    },
  );

  const handleAnimeClick = useCallback(
    (item: AnimeCalendarItem) => {
      navigate(`/subject/${item.id}`, {
        viewTransition: true,
        state: {
          name: item.name,
          imageUrl: item.image,
        },
      });
    },
    [navigate],
  );

  return {
    data,
    isLoading,
    error,
    refetch,
    handleAnimeClick,
  };
}

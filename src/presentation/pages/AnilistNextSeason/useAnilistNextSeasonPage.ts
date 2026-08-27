import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { GetNextSeasonAnimeUseCase } from "@/application/anime/GetNextSeasonAnimeUseCase";
import type { AnimeCalendarItem } from "@/domain/anime/AnimeSchemas";
import { useQuery } from "@/presentation/hooks/useQuery";
import { useAnilistNextSeasonStore } from "../../store/anilistNextSeasonStore";

export interface UseAnilistNextSeasonPageDeps {
  getAnilistNextSeasonUseCase: Pick<GetNextSeasonAnimeUseCase, "execute">;
}

export function useAnilistNextSeasonPage(deps: UseAnilistNextSeasonPageDeps) {
  const { getAnilistNextSeasonUseCase } = deps;
  const navigate = useNavigate();
  const data = useAnilistNextSeasonStore((s) => s.data);
  const setData = useAnilistNextSeasonStore((s) => s.setData);

  const {
    loading: isLoading,
    error,
    refetch,
  } = useQuery(
    (ctx) => getAnilistNextSeasonUseCase.execute(ctx),
    [getAnilistNextSeasonUseCase, data.length, setData],
    {
      enabled: data.length === 0,
      onSuccess: (result) => {
        setData(result.data);
      },
    },
  );

  const handleAnimeClick = useCallback(
    (item: AnimeCalendarItem) => {
      navigate(`/anilist/subject/${item.id}`, {
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

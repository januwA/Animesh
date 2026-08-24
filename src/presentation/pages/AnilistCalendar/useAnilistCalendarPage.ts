import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { GetAnimeCalendarUseCase } from "@/application/anime/GetAnimeCalendarUseCase";
import type { AnimeCalendarItem } from "@/domain/anime/AnimeSchemas";
import { useQuery } from "@/presentation/hooks/useQuery";
import { useAnilistCalendarStore } from "../../store/anilistCalendarStore";

export interface UseAnilistCalendarPageDeps {
  getAnilistCalendarUseCase: Pick<GetAnimeCalendarUseCase, "execute">;
}

export function useAnilistCalendarPage(deps: UseAnilistCalendarPageDeps) {
  const { getAnilistCalendarUseCase } = deps;
  const navigate = useNavigate();
  const calendar = useAnilistCalendarStore((s) => s.calendar);
  const setCalendar = useAnilistCalendarStore((s) => s.setCalendar);

  const {
    loading: isLoading,
    error,
    refetch,
  } = useQuery(
    (ctx) => getAnilistCalendarUseCase.execute(ctx),
    [getAnilistCalendarUseCase, calendar.length, setCalendar],
    {
      enabled: calendar.length === 0,
      onSuccess: (data) => {
        setCalendar(data);
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
    calendar,
    isLoading,
    error,
    refetch,
    handleAnimeClick,
  };
}

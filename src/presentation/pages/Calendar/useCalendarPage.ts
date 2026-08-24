import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { GetAnimeCalendarUseCase } from "@/application/anime/GetAnimeCalendarUseCase";
import type { AnimeCalendarItem } from "@/domain/anime/AnimeSchemas";
import { useQuery } from "@/presentation/hooks/useQuery";
import { useCalendarStore } from "../../store/calendarStore";

export interface UseCalendarPageDeps {
  getBangumiCalendarUseCase: Pick<GetAnimeCalendarUseCase, "execute">;
}

export function useCalendarPage(deps: UseCalendarPageDeps) {
  const { getBangumiCalendarUseCase } = deps;
  const navigate = useNavigate();
  const calendar = useCalendarStore((s) => s.calendar);
  const setCalendar = useCalendarStore((s) => s.setCalendar);

  const {
    loading: isLoading,
    error,
    refetch,
  } = useQuery(
    (ctx) => getBangumiCalendarUseCase.execute(ctx),
    [getBangumiCalendarUseCase, calendar.length, setCalendar],
    {
      enabled: calendar.length === 0,
      onSuccess: (data) => {
        setCalendar(data);
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
    calendar,
    isLoading,
    error,
    refetch,
    handleAnimeClick,
  };
}

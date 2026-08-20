import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { GetBangumiCalendarUseCase } from "@/application/bangumi/GetBangumiCalendarUseCase";
import type { BangumiCalendarItem } from "@/domain/bangumi/BangumiSchemas";
import { useQuery } from "@/presentation/hooks/useQuery";
import { useCalendarStore } from "../../store/calendarStore";

export interface UseCalendarPageDeps {
  getBangumiCalendarUseCase: Pick<GetBangumiCalendarUseCase, "execute">;
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
    (item: BangumiCalendarItem) => {
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

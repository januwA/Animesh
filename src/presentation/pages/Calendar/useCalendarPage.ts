import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { GetAnimeCalendarUseCase } from "@/application/anime/GetAnimeCalendarUseCase";
import type {
  AnimeCalendarDay,
  AnimeCalendarItem,
} from "@/domain/anime/AnimeSchemas";
import { useQuery } from "@/presentation/hooks/useQuery";

export interface UseCalendarPageDeps {
  getCalendarUseCase: Pick<GetAnimeCalendarUseCase, "execute">;
}

export function useCalendarPage(
  deps: UseCalendarPageDeps,
  useCalendarStore: <U>(
    selector: (state: {
      calendar: AnimeCalendarDay[];
      setCalendar: (val: AnimeCalendarDay[]) => void;
    }) => U,
  ) => U,
  subjectPath: (id: number) => string,
) {
  const { getCalendarUseCase } = deps;
  const navigate = useNavigate();
  const calendar = useCalendarStore((s) => s.calendar);
  const setCalendar = useCalendarStore((s) => s.setCalendar);

  const {
    loading: isLoading,
    error,
    refetch,
  } = useQuery(
    (ctx) => getCalendarUseCase.execute(ctx),
    [getCalendarUseCase, calendar.length, setCalendar],
    {
      enabled: calendar.length === 0,
      onSuccess: (data) => {
        setCalendar(data);
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
    calendar,
    isLoading,
    error,
    refetch,
    handleAnimeClick,
  };
}

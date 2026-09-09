import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { GetAnimeCalendarUseCase } from "@/application/anime/GetAnimeCalendarUseCase";
import type {
  AnimeCalendarDay,
  AnimeCalendarItem,
} from "@/domain/anime/AnimeSchemas";
import { useQuery } from "@/presentation/hooks/useQuery";

export interface UseSubjectCalendarPageDeps {
  getCalendarUseCase: Pick<GetAnimeCalendarUseCase, "execute">;
}

/**
 * 日历数据由基础设施层 @Cached（7 天 TTL）缓存，此处不重复缓存，
 * 直接使用 useQuery 的本地状态即可。
 */
export function useSubjectCalendarPage(
  deps: UseSubjectCalendarPageDeps,
  subjectPath: (id: number) => string,
): {
  calendar: AnimeCalendarDay[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  handleAnimeClick: (item: AnimeCalendarItem) => void;
} {
  const { getCalendarUseCase } = deps;
  const navigate = useNavigate();

  const {
    data,
    loading: isLoading,
    error,
    refetch,
  } = useQuery((ctx) => getCalendarUseCase.execute(ctx), [getCalendarUseCase]);

  const calendar = data ?? [];

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
    error: error?.message ?? null,
    refetch,
    handleAnimeClick,
  };
}

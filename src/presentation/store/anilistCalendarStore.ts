import type { AnimeCalendarDay } from "@/domain/anime/AnimeSchemas";
import { createAnimeStore } from "./createAnimeStore";

export const useAnilistCalendarStore = createAnimeStore({
  calendar: [] as AnimeCalendarDay[],
  calendarActiveDay: null as number | null,
});

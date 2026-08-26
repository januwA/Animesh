import { create } from "zustand";
import type { AnimeCalendarDay } from "@/domain/anime/AnimeSchemas";

interface AnilistCalendarStoreState {
  calendar: AnimeCalendarDay[];
  calendarActiveDay: number | null;
  setCalendar: (val: AnimeCalendarDay[]) => void;
  setCalendarActiveDay: (val: number | null) => void;
  reset: () => void;
}

const initialState = {
  calendar: [] as AnimeCalendarDay[],
  calendarActiveDay: null as number | null,
};

export const useAnilistCalendarStore = create<AnilistCalendarStoreState>()(
  (set) => ({
    ...initialState,
    setCalendar: (val) => set({ calendar: val }),
    setCalendarActiveDay: (val) => set({ calendarActiveDay: val }),
    reset: () => set(initialState),
  }),
);

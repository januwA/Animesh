import { create } from "zustand";
import type { BangumiCalendarDay } from "@/domain/bangumi/BangumiSchemas";

interface CalendarStoreState {
  calendar: BangumiCalendarDay[];
  calendarActiveDay: number | null;
  setCalendar: (val: BangumiCalendarDay[]) => void;
  setCalendarActiveDay: (val: number | null) => void;
  reset: () => void;
}

const initialState = {
  calendar: [] as BangumiCalendarDay[],
  calendarActiveDay: null as number | null,
};

export const useCalendarStore = create<CalendarStoreState>()((set) => ({
  ...initialState,
  setCalendar: (val) => set({ calendar: val }),
  setCalendarActiveDay: (val) => set({ calendarActiveDay: val }),
  reset: () => set(initialState),
}));

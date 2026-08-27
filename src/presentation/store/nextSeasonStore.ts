import { create } from "zustand";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";

export interface NextSeasonMonthData {
  items: AnimeSubject[];
  hasNextPage: boolean;
  /** 后端已无更多数据（当前页返回空数组时置 true） */
  exhausted: boolean;
}

export interface NextSeasonStoreState {
  activeMonth: number | null;
  monthsData: Record<number, NextSeasonMonthData>;
  setActiveMonth: (month: number | null) => void;
  setMonthData: (month: number, data: NextSeasonMonthData) => void;
  appendMonthItems: (
    month: number,
    items: AnimeSubject[],
    hasNextPage: boolean,
  ) => void;
  reset: () => void;
}

const initialState = {
  activeMonth: null as number | null,
  monthsData: {} as Record<number, NextSeasonMonthData>,
};

export const useNextSeasonStore = create<NextSeasonStoreState>()((set) => ({
  ...initialState,
  setActiveMonth: (month) => set({ activeMonth: month }),
  setMonthData: (month, data) =>
    set((state) => ({
      monthsData: {
        ...state.monthsData,
        [month]: data,
      },
    })),
  appendMonthItems: (month, newItems, hasNextPage) =>
    set((state) => {
      const current = state.monthsData[month] ?? {
        items: [],
        hasNextPage: true,
        exhausted: false,
      };
      // 按 id 去重，避免 AniList 分页重复返回同一条目
      const existingIds = new Set(current.items.map((it) => it.id));
      const uniqueNew = newItems.filter((it) => !existingIds.has(it.id));
      return {
        monthsData: {
          ...state.monthsData,
          [month]: {
            ...current,
            items: [...current.items, ...uniqueNew],
            hasNextPage,
            // 当本页返回空数组时，说明后端已无更多数据
            exhausted: current.exhausted || newItems.length === 0,
          },
        },
      };
    }),
  reset: () => set(initialState),
}));

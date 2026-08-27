import { create } from "zustand";
import type {
  NextSeasonMonthData,
  NextSeasonStoreState,
} from "./nextSeasonStore";

export type { NextSeasonMonthData, NextSeasonStoreState };

const initialState = {
  activeMonth: null as number | null,
  monthsData: {} as Record<number, NextSeasonMonthData>,
};

export const useAnilistNextSeasonStore = create<NextSeasonStoreState>()(
  (set) => ({
    ...initialState,
    setActiveMonth: (month) => set({ activeMonth: month }),
    setMonthData: (month, data) =>
      set((state) => ({
        monthsData: {
          ...state.monthsData,
          [month]: data,
        },
      })),
    appendMonthItems: (month, newItems) =>
      set((state) => {
        const current = state.monthsData[month] ?? {
          items: [],
          total: 0,
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
              // 当本页返回空数组时，说明后端已无更多数据
              exhausted: current.exhausted || newItems.length === 0,
            },
          },
        };
      }),
    reset: () => set(initialState),
  }),
);

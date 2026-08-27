import { create } from "zustand";
import type { NextSeasonData } from "@/domain/anime/AnimeSchemas";

interface NextSeasonStoreState {
  data: NextSeasonData;
  activeMonth: number | null;
  setData: (val: NextSeasonData) => void;
  setActiveMonth: (val: number | null) => void;
  reset: () => void;
}

const initialState = {
  data: [] as NextSeasonData,
  activeMonth: null as number | null,
};

export const useNextSeasonStore = create<NextSeasonStoreState>()((set) => ({
  ...initialState,
  setData: (val) => set({ data: val }),
  setActiveMonth: (val) => set({ activeMonth: val }),
  reset: () => set(initialState),
}));

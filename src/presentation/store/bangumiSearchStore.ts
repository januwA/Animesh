import { create } from "zustand";
import type { BangumiSubject } from "@/domain/bangumi/BangumiSchemas";

interface BangumiSearchStoreState {
  keyword: string;
  searchedKeyword: string;
  results: BangumiSubject[];
  total: number;
  hasSearched: boolean;
  setKeyword: (val: string) => void;
  setSearchedKeyword: (val: string) => void;
  setResults: (val: BangumiSubject[]) => void;
  appendResults: (val: BangumiSubject[]) => void;
  setTotal: (val: number) => void;
  setHasSearched: (val: boolean) => void;
  reset: () => void;
}

const initialState = {
  keyword: "",
  searchedKeyword: "",
  results: [] as BangumiSubject[],
  total: 0,
  hasSearched: false,
};

export const useBangumiSearchStore = create<BangumiSearchStoreState>()(
  (set) => ({
    ...initialState,
    setKeyword: (val) => set({ keyword: val }),
    setSearchedKeyword: (val) => set({ searchedKeyword: val }),
    setResults: (val) => set({ results: val }),
    appendResults: (val) =>
      set((state) => ({ results: [...state.results, ...val] })),
    setTotal: (val) => set({ total: val }),
    setHasSearched: (val) => set({ hasSearched: val }),
    reset: () => set(initialState),
  }),
);

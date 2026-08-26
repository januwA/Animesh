import { create } from "zustand";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";

interface AnilistSearchStoreState {
  keyword: string;
  searchedKeyword: string;
  results: AnimeSubject[];
  total: number;
  hasSearched: boolean;
  setKeyword: (val: string) => void;
  setSearchedKeyword: (val: string) => void;
  setResults: (val: AnimeSubject[]) => void;
  appendResults: (val: AnimeSubject[]) => void;
  setTotal: (val: number) => void;
  setHasSearched: (val: boolean) => void;
  reset: () => void;
}

const initialState = {
  keyword: "",
  searchedKeyword: "",
  results: [] as AnimeSubject[],
  total: 0,
  hasSearched: false,
};

export const useAnilistSearchStore = create<AnilistSearchStoreState>()(
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

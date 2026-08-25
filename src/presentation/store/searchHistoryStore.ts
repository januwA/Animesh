import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const STORAGE_KEY = "animesh_search_history";

interface SearchHistoryStoreState {
  history: string[];
  addHistory: (keyword: string) => void;
  deleteHistory: (keyword: string) => void;
  clearHistory: () => void;
  reset: () => void;
}

export const useSearchHistoryStore = create<SearchHistoryStoreState>()(
  persist(
    (set, get) => ({
      history: [],
      addHistory: (keyword) => {
        set({
          history: [keyword, ...get().history.filter((k) => k !== keyword)],
        });
      },
      deleteHistory: (keyword) => {
        set({ history: get().history.filter((k) => k !== keyword) });
      },
      clearHistory: () => set({ history: [] }),
      reset: () => set({ history: [] }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

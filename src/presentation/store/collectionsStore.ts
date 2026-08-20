import { create } from "zustand";
import type { FavoriteItem } from "@/domain/collection/CollectionSchemas";

interface CollectionsStoreState {
  items: FavoriteItem[];
  setItems: (val: FavoriteItem[]) => void;
  addItem: (item: Omit<FavoriteItem, "addedAt">) => void;
  removeItem: (subjectId: number) => void;
  reset: () => void;
}

const initialState = {
  items: [] as FavoriteItem[],
};

export const useCollectionsStore = create<CollectionsStoreState>()((set) => ({
  ...initialState,
  setItems: (val) => set({ items: val }),
  addItem: (item) =>
    set((s) => ({
      items: [{ ...item, addedAt: Date.now() }, ...s.items],
    })),
  removeItem: (subjectId) =>
    set((s) => ({
      items: s.items.filter((item) => item.subjectId !== subjectId),
    })),
  reset: () => set(initialState),
}));

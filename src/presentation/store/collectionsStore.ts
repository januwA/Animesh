import { create } from "zustand";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import type { FavoriteItem } from "@/domain/collection/CollectionSchemas";

interface CollectionsStoreState {
  items: FavoriteItem[];
  setItems: (val: FavoriteItem[]) => void;
  addItem: (item: Omit<FavoriteItem, "addedAt">) => void;
  removeItem: (subjectId: number, platform: AnimePlatform) => void;
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
  removeItem: (subjectId, platform) =>
    set((s) => ({
      items: s.items.filter(
        (item) => !(item.subjectId === subjectId && item.platform === platform),
      ),
    })),
  reset: () => set(initialState),
}));

import type { CollectionRepository } from "@/domain/collection/CollectionRepository";
import type {
  CollectionsState,
  FavoriteItem,
} from "@/domain/collection/CollectionSchemas";
import {
  COLLECTION_STORAGE_KEY,
  CollectionsStateSchema,
} from "@/domain/collection/CollectionSchemas";

function loadState(): CollectionsState {
  try {
    const serialized = localStorage.getItem(COLLECTION_STORAGE_KEY);
    if (!serialized) {
      return { items: [], lastUpdatedAt: Date.now() };
    }

    const parsed: unknown = JSON.parse(serialized);
    const result = CollectionsStateSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }

    localStorage.removeItem(COLLECTION_STORAGE_KEY);
    return { items: [], lastUpdatedAt: Date.now() };
  } catch {
    return { items: [], lastUpdatedAt: Date.now() };
  }
}

function saveState(state: CollectionsState): void {
  localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(state));
}

export class LocalStorageCollectionRepository implements CollectionRepository {
  private cachedState: CollectionsState | null = null;
  private cachedFavorites: Set<number> | null = null;

  private getState(): CollectionsState {
    if (!this.cachedState) {
      this.cachedState = loadState();
    }
    return this.cachedState;
  }

  private getFavoriteIds(): Set<number> {
    if (!this.cachedFavorites) {
      this.cachedFavorites = new Set(
        this.getState().items.map((item) => item.subjectId),
      );
    }
    return this.cachedFavorites;
  }

  getAll(): FavoriteItem[] {
    return this.getState().items;
  }

  isFavorited(subjectId: number): boolean {
    return this.getFavoriteIds().has(subjectId);
  }

  add(item: Omit<FavoriteItem, "addedAt">): void {
    const state = this.getState();
    if (state.items.some((i) => i.subjectId === item.subjectId)) {
      return;
    }
    state.items.push({ ...item, addedAt: Date.now() });
    state.lastUpdatedAt = Date.now();
    saveState(state);
    this.cachedFavorites?.add(item.subjectId);
  }

  remove(subjectId: number): void {
    const state = this.getState();
    state.items = state.items.filter((i) => i.subjectId !== subjectId);
    state.lastUpdatedAt = Date.now();
    saveState(state);
    this.cachedFavorites?.delete(subjectId);
  }
}

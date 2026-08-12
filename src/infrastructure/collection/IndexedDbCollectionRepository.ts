import type { CollectionRepository } from "@/domain/collection/CollectionRepository";
import type {
  CollectionsState,
  FavoriteItem,
} from "@/domain/collection/CollectionSchemas";
import {
  COLLECTION_STORAGE_KEY,
  CollectionsStateSchema,
} from "@/domain/collection/CollectionSchemas";
import type { CacheStore } from "@/infrastructure/storage/CacheStore";

const NEVER_EXPIRE_MS = Number.MAX_SAFE_INTEGER;

export class IndexedDbCollectionRepository implements CollectionRepository {
  constructor(private readonly store: CacheStore) {}

  private async getState(): Promise<CollectionsState> {
    const state = await this.store.getItem(
      COLLECTION_STORAGE_KEY,
      CollectionsStateSchema,
    );
    return state ?? { items: [], lastUpdatedAt: 0 };
  }

  private async saveState(state: CollectionsState): Promise<void> {
    await this.store.setItem(COLLECTION_STORAGE_KEY, state, NEVER_EXPIRE_MS);
  }

  async getAll(): Promise<FavoriteItem[]> {
    const state = await this.getState();
    return state.items;
  }

  async isFavorited(subjectId: number): Promise<boolean> {
    const state = await this.getState();
    return state.items.some((item) => item.subjectId === subjectId);
  }

  async add(item: Omit<FavoriteItem, "addedAt">): Promise<void> {
    const state = await this.getState();
    if (state.items.some((i) => i.subjectId === item.subjectId)) {
      return;
    }
    state.items.push({ ...item, addedAt: Date.now() });
    state.lastUpdatedAt = Date.now();
    await this.saveState(state);
  }

  async remove(subjectId: number): Promise<void> {
    const state = await this.getState();
    state.items = state.items.filter((i) => i.subjectId !== subjectId);
    state.lastUpdatedAt = Date.now();
    await this.saveState(state);
  }
}

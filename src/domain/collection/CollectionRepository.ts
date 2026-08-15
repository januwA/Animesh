import type { FavoriteItem } from "./CollectionSchemas";

export interface CollectionRepository {
  getAll(): Promise<FavoriteItem[]>;
  isFavorited(subjectId: number): Promise<boolean>;
  add(item: Omit<FavoriteItem, "addedAt">): Promise<void>;
  remove(subjectId: number): Promise<void>;
}

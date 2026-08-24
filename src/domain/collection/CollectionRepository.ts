import type { AnimePlatform } from "../anime/AnimeSchemas";
import type { FavoriteItem } from "./CollectionSchemas";

export interface CollectionRepository {
  getAll(): Promise<FavoriteItem[]>;
  isFavorited(subjectId: number, platform: AnimePlatform): Promise<boolean>;
  add(item: Omit<FavoriteItem, "addedAt">): Promise<void>;
  remove(subjectId: number, platform: AnimePlatform): Promise<void>;
}

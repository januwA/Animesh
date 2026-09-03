import type { Context } from "ajanuw-context";
import type { AnimePlatform } from "../anime/AnimeSchemas";
import type { FavoriteItem } from "./CollectionSchemas";

export interface CollectionRepository {
  getAll(): Promise<FavoriteItem[]>;
  isFavorited(subjectId: number, platform: AnimePlatform): Promise<boolean>;
  add(ctx: Context, item: Omit<FavoriteItem, "addedAt">): Promise<void>;
  remove(
    ctx: Context,
    subjectId: number,
    platform: AnimePlatform,
  ): Promise<void>;
}

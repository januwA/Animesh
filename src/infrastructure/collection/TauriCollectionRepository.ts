import { invoke } from "@tauri-apps/api/core";
import { Duration } from "ajanuw-duration";
import { z } from "zod";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import type { CollectionRepository } from "@/domain/collection/CollectionRepository";
import type { FavoriteItem } from "@/domain/collection/CollectionSchemas";
import {
  CollectionRecordSchema,
  toFavoriteItem,
} from "@/domain/collection/CollectionSchemas";
import type { CacheStore } from "@/domain/storage/CacheStore";
import { commands } from "@/generated/tauri-commands";
import { Cached } from "../cache/CachedDecorator";

const COLLECTION_CACHE_PREFIX = "UserCollection";

export class TauriCollectionRepository implements CollectionRepository {
  constructor(
    /** @internal accessed by @Cached decorator */
    public readonly store: CacheStore,
  ) {}

  @Cached({
    prefix: COLLECTION_CACHE_PREFIX,
    ttl: new Duration({ days: 10000 }),
    excludeArgs: [],
  })
  async getAll(): Promise<FavoriteItem[]> {
    const raw = await invoke<unknown>(commands.collection_get_all);
    const result = z.array(CollectionRecordSchema).safeParse(raw);
    if (!result.success) {
      throw new Error("collection_get_all API structure mismatch", {
        cause: result.error,
      });
    }
    return result.data.map(toFavoriteItem);
  }

  async isFavorited(
    subjectId: number,
    platform: AnimePlatform,
  ): Promise<boolean> {
    const raw = await invoke<unknown>(commands.collection_is_favorited, {
      subjectId,
      platform,
    });
    return z.boolean().parse(raw);
  }

  async add(item: Omit<FavoriteItem, "addedAt">): Promise<void> {
    invoke<void>(commands.collection_add, {
      subjectId: item.subjectId,
      platform: item.platform,
      name: item.name,
      imageUrl: item.imageUrl,
    });
    this.store.clearByPrefix(COLLECTION_CACHE_PREFIX);
  }

  async remove(subjectId: number, platform: AnimePlatform): Promise<void> {
    invoke<void>(commands.collection_remove, { subjectId, platform });
    this.store.clearByPrefix(COLLECTION_CACHE_PREFIX);
  }
}

import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import type { CollectionRepository } from "@/domain/collection/CollectionRepository";
import type { FavoriteItem } from "@/domain/collection/CollectionSchemas";
import {
  CollectionRecordSchema,
  toFavoriteItem,
} from "@/domain/collection/CollectionSchemas";
import { commands } from "@/generated/tauri-commands";

export class TauriCollectionRepository implements CollectionRepository {
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
    return invoke<void>(commands.collection_add, {
      subjectId: item.subjectId,
      platform: item.platform,
      name: item.name,
      imageUrl: item.imageUrl,
    });
  }

  async remove(subjectId: number, platform: AnimePlatform): Promise<void> {
    return invoke<void>(commands.collection_remove, { subjectId, platform });
  }
}

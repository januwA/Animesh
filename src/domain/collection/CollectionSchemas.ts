import { z } from "zod";
import { AnimePlatformSchema } from "../anime/AnimeSchemas";

export const FavoriteItemSchema = z.object({
  subjectId: z.number(),
  platform: AnimePlatformSchema,
  name: z.string(),
  imageUrl: z.string().nullable(),
  addedAt: z.number(),
});

export type FavoriteItem = z.infer<typeof FavoriteItemSchema>;

/** 后端 SQLite 返回的收藏记录结构（snake_case）。 */
export const CollectionRecordSchema = z.object({
  subject_id: z.number(),
  platform: AnimePlatformSchema,
  name: z.string(),
  image_url: z.string().nullable(),
  added_at: z.number(),
});

export type CollectionRecord = z.infer<typeof CollectionRecordSchema>;

export function toFavoriteItem(record: CollectionRecord): FavoriteItem {
  return {
    subjectId: record.subject_id,
    platform: record.platform,
    name: record.name,
    imageUrl: record.image_url,
    addedAt: record.added_at,
  };
}

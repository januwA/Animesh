import { Background, type Context } from "ajanuw-context";
import { z } from "zod";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import type { CollectionRepository } from "@/domain/collection/CollectionRepository";
import type { FavoriteItem } from "@/domain/collection/CollectionSchemas";
import {
  CollectionRecordSchema,
  toFavoriteItem,
} from "@/domain/collection/CollectionSchemas";
import type { HttpClient } from "@/domain/http/HttpClient";

const baseUrl = import.meta.env.PROD
  ? "/api"
  : (import.meta.env.VITE_API_BASE_URL as string) || "/api";

export class HttpCollectionRepository implements CollectionRepository {
  constructor(private readonly httpClient: HttpClient) {}

  async getAll(): Promise<FavoriteItem[]> {
    const raw = await this.httpClient.getJson<unknown>(
      Background,
      `${baseUrl}/collections`,
    );
    const result = z.array(CollectionRecordSchema).safeParse(raw);
    if (!result.success) {
      throw new Error("GET /collections structure mismatch", {
        cause: result.error,
      });
    }
    return result.data.map(toFavoriteItem);
  }

  async isFavorited(
    subjectId: number,
    platform: AnimePlatform,
  ): Promise<boolean> {
    const items = await this.getAll();
    return items.some(
      (item) => item.subjectId === subjectId && item.platform === platform,
    );
  }

  async add(ctx: Context, item: Omit<FavoriteItem, "addedAt">): Promise<void> {
    await this.httpClient.request(ctx, `${baseUrl}/collections`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject_id: item.subjectId,
        platform: item.platform,
        name: item.name,
        image_url: item.imageUrl,
      }),
    });
  }

  async remove(
    ctx: Context,
    subjectId: number,
    platform: AnimePlatform,
  ): Promise<void> {
    await this.httpClient.request(
      ctx,
      `${baseUrl}/collections/${platform}/${subjectId}`,
      { method: "DELETE" },
    );
  }
}

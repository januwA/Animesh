import { z } from "zod";
import type { CollectionRepository } from "@/domain/collection/CollectionRepository";
import type { FavoriteItem } from "@/domain/collection/CollectionSchemas";
import {
  CollectionRecordSchema,
  toFavoriteItem,
} from "@/domain/collection/CollectionSchemas";
import { HttpClient } from "../http/HttpClient";

const baseUrl = import.meta.env.PROD
  ? "/api"
  : (import.meta.env.VITE_API_BASE_URL as string) || "/api";

export class HttpCollectionRepository implements CollectionRepository {
  private readonly httpClient: HttpClient;

  constructor() {
    this.httpClient = new HttpClient();
  }

  async getAll(): Promise<FavoriteItem[]> {
    const raw = await this.httpClient.getJson<unknown>(
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

  async isFavorited(subjectId: number): Promise<boolean> {
    const items = await this.getAll();
    return items.some((item) => item.subjectId === subjectId);
  }

  async add(item: Omit<FavoriteItem, "addedAt">): Promise<void> {
    await this.httpClient.request(`${baseUrl}/collections`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject_id: item.subjectId,
        name: item.name,
        image_url: item.imageUrl,
      }),
    });
  }

  async remove(subjectId: number): Promise<void> {
    await this.httpClient.request(`${baseUrl}/collections/${subjectId}`, {
      method: "DELETE",
    });
  }
}

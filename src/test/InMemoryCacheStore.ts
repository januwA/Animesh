import type { Context } from "ajanuw-context";
import { z } from "zod";
import type { CacheStore } from "@/domain/storage/CacheStore";

const EnvelopeSchema = z.object({
  data: z.unknown(),
  expiry: z.number(),
});

/**
 * 内存版 CacheStore Mock，供单元测试注入，避免真实接触浏览器存储。
 */
export class InMemoryCacheStore implements CacheStore {
  private readonly records = new Map<
    string,
    { data: unknown; expiry: number }
  >();

  async getItem<T>(
    _ctx: Context,
    key: string,
    schema: z.ZodType<T>,
  ): Promise<T | null> {
    const record = this.records.get(key);
    if (!record) {
      return null;
    }

    const envelopeResult = EnvelopeSchema.safeParse(record);
    if (!envelopeResult.success) {
      this.records.delete(key);
      return null;
    }

    const { data, expiry } = envelopeResult.data;
    if (Date.now() > expiry) {
      this.records.delete(key);
      return null;
    }

    const validationResult = schema.safeParse(data);
    if (!validationResult.success) {
      this.records.delete(key);
      return null;
    }

    return validationResult.data;
  }

  async setItem<T>(
    _ctx: Context,
    key: string,
    data: T,
    ttlMs: number,
  ): Promise<void> {
    this.records.set(key, { data, expiry: Date.now() + ttlMs });
  }

  async removeItem(_ctx: Context, key: string): Promise<void> {
    this.records.delete(key);
  }

  async clear(_ctx: Context): Promise<void> {
    this.records.clear();
  }

  async clearByPrefix(_ctx: Context, prefix: string): Promise<void> {
    for (const key of this.records.keys()) {
      if (key.startsWith(`${prefix}:`)) {
        this.records.delete(key);
      }
    }
  }

  async clearExpired(_ctx: Context): Promise<number> {
    const now = Date.now();
    let deletedCount = 0;
    for (const [key, record] of this.records) {
      if (now > record.expiry) {
        this.records.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  /**
   * 直接写入原始信封记录，用于构造损坏数据场景。
   */
  setRawEntry(key: string, record: unknown): void {
    this.records.set(key, record as { data: unknown; expiry: number });
  }
}

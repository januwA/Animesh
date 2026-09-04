import type { Context } from "ajanuw-context";
import type { z } from "zod";

/**
 * 通用键值缓存存储接口。
 * 测试时可通过该接口注入内存 Mock，避免直接接触浏览器存储。
 */
export interface CacheStore {
  getItem<T>(
    ctx: Context,
    key: string,
    schema: z.ZodType<T>,
  ): Promise<T | null>;
  setItem<T>(ctx: Context, key: string, data: T, ttlMs: number): Promise<void>;
  removeItem(ctx: Context, key: string): Promise<void>;
  clear(ctx: Context): Promise<void>;
  clearByPrefix(ctx: Context, prefix: string): Promise<void>;
  clearExpired(ctx: Context): Promise<number>;
}

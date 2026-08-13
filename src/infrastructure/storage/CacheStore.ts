import type { z } from "zod";

/**
 * 通用键值缓存存储接口。真实依赖 IndexedDB 的实现为 IndexedDbCacheStore，
 * 测试时可通过该接口注入内存 Mock，避免直接接触浏览器存储。
 */
export interface CacheStore {
  getItem<T>(key: string, schema: z.ZodType<T>): Promise<T | null>;
  setItem<T>(key: string, data: T, ttlMs: number): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  /** 清空所有非保护键名的缓存记录，用于保留用户数据（如收藏）的缓存清理。 */
  clearCache(protectedKeys: string[]): Promise<void>;
}

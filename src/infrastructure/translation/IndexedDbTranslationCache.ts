import { Duration } from "ajanuw-duration";
import { z } from "zod";
import type { TranslationCache } from "@/domain/translation/TranslationCache";
import type { CacheStore } from "@/infrastructure/storage/CacheStore";

const TRANSLATION_CACHE_PREFIX = "translation";
const TRANSLATION_CACHE_TTL_MS = new Duration({ days: 7 }).inMilliseconds;

/**
 * 基于 IndexedDB 的翻译缓存实现。
 * 使用 CacheStore 接口，与项目现有的缓存基础设施一致。
 */
export class IndexedDbTranslationCache implements TranslationCache {
  constructor(private readonly store: CacheStore) {}

  async get(key: string): Promise<string | null> {
    return this.store.getItem(this.toCacheKey(key), z.string());
  }

  async set(key: string, value: string): Promise<void> {
    await this.store.setItem(
      this.toCacheKey(key),
      value,
      TRANSLATION_CACHE_TTL_MS,
    );
  }

  private toCacheKey(key: string): string {
    return `${TRANSLATION_CACHE_PREFIX}:${key}`;
  }
}

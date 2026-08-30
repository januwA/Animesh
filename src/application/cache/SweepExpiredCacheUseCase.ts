import type { CacheStore } from "@/domain/storage/CacheStore";

/**
 * 启动时清理已过期的缓存条目，防止过期数据永久占用存储空间。
 */
export class SweepExpiredCacheUseCase {
  constructor(private readonly cacheStore: CacheStore) {}

  async execute(): Promise<number> {
    return this.cacheStore.clearExpired();
  }
}

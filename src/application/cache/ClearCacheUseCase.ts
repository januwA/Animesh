import { COLLECTION_STORAGE_KEY } from "@/domain/collection/CollectionSchemas";
import type { CacheStore } from "@/infrastructure/storage/CacheStore";

/**
 * 清理所有联网数据缓存（bangumi 日历/条目详情/剧集/角色/制作人员与 IPTV 等），
 * 同时保留用户收藏等本地数据。
 */
export class ClearCacheUseCase {
  constructor(private readonly cacheStore: CacheStore) {}

  async execute(): Promise<void> {
    await this.cacheStore.clearCache([COLLECTION_STORAGE_KEY]);
  }
}

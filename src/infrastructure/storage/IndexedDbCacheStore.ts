import { z } from "zod";
import type { CacheStore } from "./CacheStore";

const DB_NAME = "animesh-cache";
const DB_VERSION = 1;
const STORE_NAME = "cache";

const CacheEnvelopeSchema = z.object({
  data: z.unknown(),
  expiry: z.number(),
});

export class IndexedDbCacheStore implements CacheStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("indexedDB 打开失败"));
    });
  }

  private getDb(): Promise<IDBDatabase> {
    this.dbPromise ??= this.openDatabase();
    return this.dbPromise;
  }

  private runTransaction<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T> | undefined,
  ): Promise<T | undefined> {
    return this.getDb().then(
      (db) =>
        new Promise<T | undefined>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, mode);
          const store = tx.objectStore(STORE_NAME);
          const req = action(store);
          tx.oncomplete = () => resolve(req?.result);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        }),
    );
  }

  async getItem<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
    try {
      const record: unknown = await this.runTransaction("readonly", (store) =>
        store.get(key),
      );
      if (!record) {
        return null;
      }

      const envelopeResult = CacheEnvelopeSchema.safeParse(record);
      if (!envelopeResult.success) {
        await this.removeItem(key);
        return null;
      }

      const { data, expiry } = envelopeResult.data;
      if (Date.now() > expiry) {
        await this.removeItem(key);
        return null;
      }

      const validationResult = schema.safeParse(data);
      if (!validationResult.success) {
        await this.removeItem(key);
        return null;
      }

      return validationResult.data;
    } catch {
      return null;
    }
  }

  /**
   * 写入带 TTL 的缓存。存储失败（如配额不足）时静默忽略，不阻塞业务。
   */
  async setItem<T>(key: string, data: T, ttlMs: number): Promise<void> {
    const entry = {
      data,
      expiry: Date.now() + ttlMs,
    };
    try {
      await this.runTransaction("readwrite", (store) => store.put(entry, key));
    } catch {
      // 缓存写入失败不影响主流程
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await this.runTransaction("readwrite", (store) => store.delete(key));
    } catch {
      // 忽略清理失败
    }
  }

  async clear(): Promise<void> {
    try {
      await this.runTransaction("readwrite", (store) => store.clear());
    } catch {
      // 忽略清理失败
    }
  }

  async clearCache(protectedKeys: string[]): Promise<void> {
    const protectedSet = new Set(protectedKeys);
    try {
      await this.getDb().then(
        (db) =>
          new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.openCursor();
            req.onsuccess = () => {
              const cursor = req.result;
              if (!cursor) return;
              if (!protectedSet.has(cursor.key as string)) {
                cursor.delete();
              }
              cursor.continue();
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
          }),
      );
    } catch {
      // 忽略清理失败
    }
  }
}

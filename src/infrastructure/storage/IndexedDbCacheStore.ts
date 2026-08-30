import { z } from "zod";
import type { Logger } from "@/domain/logger/logger";
import type { CacheStore } from "@/domain/storage/CacheStore";
import { Logged } from "../logger/LoggedDecorator";

const DB_NAME = "animesh-cache";
const DB_VERSION = 1;
const STORE_NAME = "cache";

const CacheEnvelopeSchema = z.object({
  data: z.unknown(),
  expiry: z.number(),
});

export class IndexedDbCacheStore implements CacheStore {
  constructor(public readonly logger: Logger) {}
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

  @Logged({ excludeArgs: [1] })
  async getItem<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
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
  }

  @Logged()
  async setItem<T>(key: string, data: T, ttlMs: number): Promise<void> {
    const entry = {
      data,
      expiry: Date.now() + ttlMs,
    };
    await this.runTransaction("readwrite", (store) => store.put(entry, key));
  }

  @Logged()
  async removeItem(key: string): Promise<void> {
    await this.runTransaction("readwrite", (store) => store.delete(key));
  }

  @Logged()
  async clear(): Promise<void> {
    await this.runTransaction("readwrite", (store) => store.clear());
  }

  @Logged()
  async clearExpired(): Promise<number> {
    const now = Date.now();
    let deletedCount = 0;
    const db = await this.getDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    return new Promise<number>((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const record = cursor.value as { expiry?: number } | undefined;
          if (record?.expiry !== undefined && now > record.expiry) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve(deletedCount);
      tx.onerror = () => reject(tx.error);
    });
  }

  @Logged()
  async clearByPrefix(prefix: string): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    return new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const key = String(cursor.key);
          if (key.startsWith(`${prefix}:`)) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

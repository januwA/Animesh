import { Duration } from "ajanuw-duration";
import { beforeEach, describe, expect, it, type Mocked, vi } from "vitest";
import type { CacheStore } from "@/domain/storage/CacheStore";
import { Cached } from "./CachedDecorator";

function createMockStore(overrides?: Partial<CacheStore>): Mocked<CacheStore> {
  return {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    clearByPrefix: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as Mocked<CacheStore>;
}

describe("Cached 装饰器", () => {
  let store: Mocked<CacheStore>;

  beforeEach(() => {
    store = createMockStore();
  });

  describe("store 不存在时", () => {
    it("应直接调用原方法，不经过缓存", async () => {
      class TestService {
        store: CacheStore | undefined = undefined;

        @Cached({ ttl: new Duration({ minutes: 5 }) })
        async fetchData(id: string): Promise<string> {
          return `fresh-${id}`;
        }
      }

      const service = new TestService();
      const result = await service.fetchData("42");

      expect(result).toBe("fresh-42");
      expect(store.getItem).not.toHaveBeenCalled();
      expect(store.setItem).not.toHaveBeenCalled();
    });
  });

  describe("swallowErrors: false（默认）", () => {
    it("getItem 失败应向上抛出异常", async () => {
      store.getItem.mockRejectedValue(new Error("DB read failed"));

      class TestService {
        store: CacheStore = store;

        @Cached({ ttl: new Duration({ minutes: 5 }) })
        async fetchData(id: string): Promise<string> {
          return `fresh-${id}`;
        }
      }

      const service = new TestService();
      await expect(service.fetchData("42")).rejects.toThrow("DB read failed");
    });

    it("setItem 失败应向上抛出异常", async () => {
      store.setItem.mockRejectedValue(new Error("DB write failed"));

      class TestService {
        store: CacheStore = store;

        @Cached({ ttl: new Duration({ minutes: 5 }) })
        async fetchData(id: string): Promise<string> {
          return `fresh-${id}`;
        }
      }

      const service = new TestService();
      await expect(service.fetchData("42")).rejects.toThrow("DB write failed");
    });
  });

  describe("swallowErrors: true", () => {
    it("getItem 失败应视为 cache miss，调用原方法", async () => {
      store.getItem.mockRejectedValue(new Error("DB read failed"));

      class TestService {
        store: CacheStore = store;

        @Cached({
          ttl: new Duration({ minutes: 5 }),
          swallowErrors: true,
        })
        async fetchData(id: string): Promise<string> {
          return `fresh-${id}`;
        }
      }

      const service = new TestService();
      const result = await service.fetchData("42");

      expect(result).toBe("fresh-42");
      expect(store.setItem).toHaveBeenCalledWith(
        expect.any(String),
        "fresh-42",
        300_000,
      );
    });

    it("setItem 失败应静默忽略，仍返回结果", async () => {
      store.setItem.mockRejectedValue(new Error("DB write failed"));

      class TestService {
        store: CacheStore = store;

        @Cached({
          ttl: new Duration({ minutes: 5 }),
          swallowErrors: true,
        })
        async fetchData(id: string): Promise<string> {
          return `fresh-${id}`;
        }
      }

      const service = new TestService();
      const result = await service.fetchData("42");

      expect(result).toBe("fresh-42");
    });
  });

  describe("缓存命中", () => {
    it("应返回缓存值，不调用原方法", async () => {
      store.getItem.mockResolvedValue("cached-value");

      class TestService {
        store: CacheStore = store;

        @Cached({ ttl: new Duration({ minutes: 5 }) })
        async fetchData(id: string): Promise<string> {
          return `fresh-${id}`;
        }
      }

      const service = new TestService();
      const result = await service.fetchData("42");

      expect(result).toBe("cached-value");
      expect(store.setItem).not.toHaveBeenCalled();
    });
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { InMemoryCacheStore } from "@/test/InMemoryCacheStore";
import { SweepExpiredCacheUseCase } from "./SweepExpiredCacheUseCase";

describe("SweepExpiredCacheUseCase 清理过期缓存用例", () => {
  const anySchema = z.unknown();
  let store: InMemoryCacheStore;
  let useCase: SweepExpiredCacheUseCase;

  beforeEach(() => {
    store = new InMemoryCacheStore();
    useCase = new SweepExpiredCacheUseCase(store);
  });

  it("应该删除所有过期条目并返回删除数量", async () => {
    await store.setItem("expired:1", { id: 1 }, -1000);
    await store.setItem("expired:2", { id: 2 }, -2000);
    await store.setItem("valid:1", { id: 3 }, 60_000);

    const deleted = await useCase.execute();

    expect(deleted).toBe(2);
    await expect(store.getItem("expired:1", anySchema)).resolves.toBeNull();
    await expect(store.getItem("expired:2", anySchema)).resolves.toBeNull();
    await expect(store.getItem("valid:1", anySchema)).resolves.toEqual({
      id: 3,
    });
  });

  it("没有过期条目时应返回 0", async () => {
    await store.setItem("valid:1", { id: 1 }, 60_000);
    await store.setItem("valid:2", { id: 2 }, 60_000);

    const deleted = await useCase.execute();

    expect(deleted).toBe(0);
    await expect(store.getItem("valid:1", anySchema)).resolves.toEqual({
      id: 1,
    });
  });

  it("空缓存下执行也不应该报错", async () => {
    const deleted = await useCase.execute();
    expect(deleted).toBe(0);
  });
});

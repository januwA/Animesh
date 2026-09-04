import { Background } from "ajanuw-context";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { InMemoryCacheStore } from "@/test/InMemoryCacheStore";
import { ClearCacheUseCase } from "./ClearCacheUseCase";

describe("ClearCacheUseCase 清理联网缓存用例", () => {
  const anySchema = z.unknown();
  let store: InMemoryCacheStore;
  let useCase: ClearCacheUseCase;

  const cacheKeys = [
    "bangumi:calendar",
    "bangumi:subject:42",
    "bangumi:episodes:42:0:50",
    "bangumi:persons:42",
    "bangumi:characters:42",
    "iptv:countries",
    "iptv:channels:cn",
  ];

  beforeEach(() => {
    store = new InMemoryCacheStore();
    useCase = new ClearCacheUseCase(store);
  });

  async function seedCache() {
    for (const key of cacheKeys) {
      await store.setItem(Background, key, { id: 1 }, 60_000);
    }
  }

  it("应该清空全部缓存", async () => {
    await seedCache();
    await useCase.execute(Background);
    for (const key of cacheKeys) {
      await expect(
        store.getItem(Background, key, anySchema),
      ).resolves.toBeNull();
    }
  });

  it("在空仓库下执行也不应该报错", async () => {
    await expect(useCase.execute(Background)).resolves.toBeUndefined();
  });
});

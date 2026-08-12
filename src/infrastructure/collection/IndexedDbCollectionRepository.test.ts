import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryCacheStore } from "@/test/InMemoryCacheStore";
import { IndexedDbCollectionRepository } from "./IndexedDbCollectionRepository";

describe("IndexedDbCollectionRepository 本地存储收藏仓库", () => {
  let repo: IndexedDbCollectionRepository;
  let store: InMemoryCacheStore;

  beforeEach(() => {
    store = new InMemoryCacheStore();
    repo = new IndexedDbCollectionRepository(store);
  });

  const mockItem = {
    subjectId: 101,
    name: "Original Name",
    nameCn: "中文名称",
    imageUrl: "https://example.com/image.jpg",
    rating: 8.5,
    platform: "TV",
    date: "2026-07-01",
    summary: "剧情简介",
  };

  it("当无数据时应返回空列表", async () => {
    expect(await repo.getAll()).toEqual([]);
  });

  it("添加收藏后应能在列表中查到", async () => {
    await repo.add(mockItem);
    expect(await repo.getAll()).toHaveLength(1);
    expect(await repo.isFavorited(101)).toBe(true);
  });

  it("添加重复 subjectId 不应重复添加", async () => {
    await repo.add(mockItem);
    await repo.add(mockItem);
    expect(await repo.getAll()).toHaveLength(1);
  });

  it("移除收藏后应正确删除", async () => {
    await repo.add(mockItem);
    await repo.remove(101);
    expect(await repo.isFavorited(101)).toBe(false);
    expect(await repo.getAll()).toHaveLength(0);
  });

  it("查询不存在的 subjectId 应返回 false", async () => {
    expect(await repo.isFavorited(999)).toBe(false);
  });

  it("移除不存在的 subjectId 不应报错", async () => {
    await expect(repo.remove(999)).resolves.toBeUndefined();
  });

  it("当存储中的数据损坏时应返回空状态", async () => {
    store.setRawEntry("animesh:collections", { invalid: true });
    expect(await repo.getAll()).toEqual([]);
  });

  it("不同仓库实例的收藏数据不应互相污染", async () => {
    await repo.add(mockItem);
    const otherRepo = new IndexedDbCollectionRepository(
      new InMemoryCacheStore(),
    );
    expect(await otherRepo.getAll()).toEqual([]);
  });
});

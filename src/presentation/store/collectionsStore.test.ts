import { describe, expect, it } from "vitest";
import { useCollectionsStore } from "./collectionsStore";

const makeItem = (subjectId: number, name = "测试动画") => ({
  subjectId,
  name,
  imageUrl: null as string | null,
  addedAt: 0,
});

describe("收藏列表全局状态 store", () => {
  afterEach(() => {
    useCollectionsStore.getState().reset();
  });

  it("应该提供空的初始状态", () => {
    expect(useCollectionsStore.getState().items).toEqual([]);
  });

  it("setItems 应该整体替换列表", () => {
    const item = makeItem(101);
    useCollectionsStore.getState().setItems([item]);

    expect(useCollectionsStore.getState().items).toEqual([item]);
  });

  it("addItem 应该前插新条目并填充 addedAt", () => {
    useCollectionsStore.getState().setItems([makeItem(101)]);
    useCollectionsStore.getState().addItem(makeItem(102, "新动画"));

    const items = useCollectionsStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      subjectId: 102,
      name: "新动画",
      imageUrl: null,
    });
    expect(items[0].addedAt).toBeGreaterThan(0);
  });

  it("removeItem 应该按 subjectId 移除条目", () => {
    useCollectionsStore.getState().setItems([makeItem(101), makeItem(102)]);
    useCollectionsStore.getState().removeItem(101);

    expect(useCollectionsStore.getState().items).toEqual([makeItem(102)]);
  });

  it("reset 应该恢复初始状态", () => {
    useCollectionsStore.getState().setItems([makeItem(101)]);
    useCollectionsStore.getState().reset();

    expect(useCollectionsStore.getState().items).toEqual([]);
  });
});

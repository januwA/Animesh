import { afterEach, describe, expect, it } from "vitest";
import { createNextSeasonStore } from "./nextSeasonStore";

const mockItem = { id: 1, name: "Test", image: "", rating: 8, summary: "" };

describe("下季新番全局状态 store", () => {
  const store = createNextSeasonStore();

  afterEach(() => {
    store.getState().reset();
  });

  it("应该提供默认状态", () => {
    const state = store.getState();
    expect(state.monthsData).toEqual({});
    expect(state.activeMonth).toBeNull();
  });

  it("应该能通过 setMonthData 更新指定月份数据", () => {
    store.getState().setMonthData(10, {
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
    expect(store.getState().monthsData[10]).toEqual({
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
  });

  it("应该能通过 appendMonthItems 追加指定月份数据", () => {
    store.getState().setMonthData(10, {
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
    const mockItem2 = {
      id: 2,
      name: "Test2",
      image: "",
      rating: 9,
      summary: "",
    };
    store.getState().appendMonthItems(10, [mockItem2], true);
    expect(store.getState().monthsData[10]?.items).toEqual([
      mockItem,
      mockItem2,
    ]);
    expect(store.getState().monthsData[10]?.exhausted).toBe(false);
  });

  it("appendMonthItems 追加重复 id 的条目时应该去重", () => {
    store.getState().setMonthData(10, {
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
    // 同 id=1 再次追加
    store.getState().appendMonthItems(10, [mockItem], true);
    expect(store.getState().monthsData[10]?.items).toHaveLength(1);
  });

  it("appendMonthItems 传入空数组时应该将月份标记为 exhausted", () => {
    store.getState().setMonthData(10, {
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
    store.getState().appendMonthItems(10, [], false);
    expect(store.getState().monthsData[10]?.exhausted).toBe(true);
  });

  it("对未初始化的月份调用 appendMonthItems 应该能正常追加", () => {
    store.getState().appendMonthItems(11, [mockItem], true);
    expect(store.getState().monthsData[11]).toEqual({
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
  });

  it("应该能通过 setActiveMonth 更新选中月份", () => {
    store.getState().setActiveMonth(10);
    expect(store.getState().activeMonth).toBe(10);
    store.getState().setActiveMonth(null);
    expect(store.getState().activeMonth).toBeNull();
  });

  it("应该能通过 reset 恢复初始状态", () => {
    store.getState().setMonthData(10, {
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
    store.getState().setActiveMonth(10);
    store.getState().reset();
    expect(store.getState()).toMatchObject({
      monthsData: {},
      activeMonth: null,
    });
  });
});

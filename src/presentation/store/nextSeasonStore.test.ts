import { afterEach, describe, expect, it } from "vitest";
import { useNextSeasonStore } from "./nextSeasonStore";

const mockItem = { id: 1, name: "Test", image: "", rating: 8, summary: "" };

describe("下季新番全局状态 store", () => {
  afterEach(() => {
    useNextSeasonStore.getState().reset();
  });

  it("应该提供默认状态", () => {
    const state = useNextSeasonStore.getState();
    expect(state.monthsData).toEqual({});
    expect(state.activeMonth).toBeNull();
  });

  it("应该能通过 setMonthData 更新指定月份数据", () => {
    useNextSeasonStore.getState().setMonthData(10, {
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
    expect(useNextSeasonStore.getState().monthsData[10]).toEqual({
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
  });

  it("应该能通过 appendMonthItems 追加指定月份数据", () => {
    useNextSeasonStore.getState().setMonthData(10, {
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
    useNextSeasonStore.getState().appendMonthItems(10, [mockItem2], true);
    expect(useNextSeasonStore.getState().monthsData[10]?.items).toEqual([
      mockItem,
      mockItem2,
    ]);
    expect(useNextSeasonStore.getState().monthsData[10]?.exhausted).toBe(false);
  });

  it("appendMonthItems 追加重复 id 的条目时应该去重", () => {
    useNextSeasonStore.getState().setMonthData(10, {
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
    // 同 id=1 再次追加
    useNextSeasonStore.getState().appendMonthItems(10, [mockItem], true);
    expect(useNextSeasonStore.getState().monthsData[10]?.items).toHaveLength(1);
  });

  it("appendMonthItems 传入空数组时应该将月份标记为 exhausted", () => {
    useNextSeasonStore.getState().setMonthData(10, {
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
    useNextSeasonStore.getState().appendMonthItems(10, [], false);
    expect(useNextSeasonStore.getState().monthsData[10]?.exhausted).toBe(true);
  });

  it("对未初始化的月份调用 appendMonthItems 应该能正常追加", () => {
    useNextSeasonStore.getState().appendMonthItems(11, [mockItem], true);
    expect(useNextSeasonStore.getState().monthsData[11]).toEqual({
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
  });

  it("应该能通过 setActiveMonth 更新选中月份", () => {
    useNextSeasonStore.getState().setActiveMonth(10);
    expect(useNextSeasonStore.getState().activeMonth).toBe(10);
    useNextSeasonStore.getState().setActiveMonth(null);
    expect(useNextSeasonStore.getState().activeMonth).toBeNull();
  });

  it("应该能通过 reset 恢复初始状态", () => {
    useNextSeasonStore.getState().setMonthData(10, {
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
    useNextSeasonStore.getState().setActiveMonth(10);
    useNextSeasonStore.getState().reset();
    expect(useNextSeasonStore.getState()).toMatchObject({
      monthsData: {},
      activeMonth: null,
    });
  });
});

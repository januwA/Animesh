import { afterEach, describe, expect, it } from "vitest";
import { useAnilistNextSeasonStore } from "./anilistNextSeasonStore";

const mockItem = { id: 1, name: "Test", image: "", rating: 8, summary: "" };

describe("Anilist 下季新番全局状态 store", () => {
  afterEach(() => {
    useAnilistNextSeasonStore.getState().reset();
  });

  it("应该提供默认状态", () => {
    const state = useAnilistNextSeasonStore.getState();
    expect(state.monthsData).toEqual({});
    expect(state.activeMonth).toBeNull();
  });

  it("应该能通过 setMonthData 更新指定月份数据", () => {
    useAnilistNextSeasonStore.getState().setMonthData(10, {
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
    expect(useAnilistNextSeasonStore.getState().monthsData[10]).toEqual({
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
  });

  it("应该能通过 appendMonthItems 追加指定月份数据", () => {
    useAnilistNextSeasonStore.getState().setMonthData(10, {
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
    useAnilistNextSeasonStore
      .getState()
      .appendMonthItems(10, [mockItem2], true);
    expect(useAnilistNextSeasonStore.getState().monthsData[10]?.items).toEqual([
      mockItem,
      mockItem2,
    ]);
    expect(useAnilistNextSeasonStore.getState().monthsData[10]?.exhausted).toBe(
      false,
    );
  });

  it("appendMonthItems 追加重复 id 的条目时应该去重", () => {
    useAnilistNextSeasonStore.getState().setMonthData(10, {
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
    useAnilistNextSeasonStore.getState().appendMonthItems(10, [mockItem], true);
    expect(
      useAnilistNextSeasonStore.getState().monthsData[10]?.items,
    ).toHaveLength(1);
  });

  it("appendMonthItems 传入空数组时应该将月份标记为 exhausted", () => {
    useAnilistNextSeasonStore.getState().setMonthData(10, {
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
    useAnilistNextSeasonStore.getState().appendMonthItems(10, [], false);
    expect(useAnilistNextSeasonStore.getState().monthsData[10]?.exhausted).toBe(
      true,
    );
  });

  it("应该能通过 setActiveMonth 更新选中月份", () => {
    useAnilistNextSeasonStore.getState().setActiveMonth(10);
    expect(useAnilistNextSeasonStore.getState().activeMonth).toBe(10);
    useAnilistNextSeasonStore.getState().setActiveMonth(null);
    expect(useAnilistNextSeasonStore.getState().activeMonth).toBeNull();
  });

  it("应该能通过 reset 恢复初始状态", () => {
    useAnilistNextSeasonStore.getState().setMonthData(10, {
      items: [mockItem],
      hasNextPage: true,
      exhausted: false,
    });
    useAnilistNextSeasonStore.getState().setActiveMonth(10);
    useAnilistNextSeasonStore.getState().reset();
    expect(useAnilistNextSeasonStore.getState()).toMatchObject({
      monthsData: {},
      activeMonth: null,
    });
  });
});

import { describe, expect, it } from "vitest";
import { useAnilistNextSeasonStore } from "./anilistNextSeasonStore";

const mockData = [
  {
    month: 10,
    label: "10月",
    items: [{ id: 1, name: "Test", image: "", rating: 8 }],
  },
];

describe("Anilist 下季新番全局状态 store", () => {
  afterEach(() => {
    useAnilistNextSeasonStore.getState().reset();
  });

  it("应该提供默认状态", () => {
    const state = useAnilistNextSeasonStore.getState();
    expect(state.data).toEqual([]);
    expect(state.activeMonth).toBeNull();
  });

  it("应该能通过 setData 更新数据", () => {
    useAnilistNextSeasonStore.getState().setData(mockData);
    expect(useAnilistNextSeasonStore.getState().data).toEqual(mockData);
  });

  it("应该能通过 setActiveMonth 更新选中月份", () => {
    useAnilistNextSeasonStore.getState().setActiveMonth(10);
    expect(useAnilistNextSeasonStore.getState().activeMonth).toBe(10);
    useAnilistNextSeasonStore.getState().setActiveMonth(null);
    expect(useAnilistNextSeasonStore.getState().activeMonth).toBeNull();
  });

  it("应该能通过 reset 恢复初始状态", () => {
    useAnilistNextSeasonStore.getState().setData(mockData);
    useAnilistNextSeasonStore.getState().setActiveMonth(10);
    useAnilistNextSeasonStore.getState().reset();
    expect(useAnilistNextSeasonStore.getState()).toMatchObject({
      data: [],
      activeMonth: null,
    });
  });
});

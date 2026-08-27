import { describe, expect, it } from "vitest";
import { useNextSeasonStore } from "./nextSeasonStore";

const mockData = [
  {
    month: 10,
    label: "10月",
    items: [{ id: 1, name: "Test", image: "", rating: 8 }],
  },
];

describe("下季新番全局状态 store", () => {
  afterEach(() => {
    useNextSeasonStore.getState().reset();
  });

  it("应该提供默认状态", () => {
    const state = useNextSeasonStore.getState();
    expect(state.data).toEqual([]);
    expect(state.activeMonth).toBeNull();
  });

  it("应该能通过 setData 更新数据", () => {
    useNextSeasonStore.getState().setData(mockData);
    expect(useNextSeasonStore.getState().data).toEqual(mockData);
  });

  it("应该能通过 setActiveMonth 更新选中月份", () => {
    useNextSeasonStore.getState().setActiveMonth(10);
    expect(useNextSeasonStore.getState().activeMonth).toBe(10);
    useNextSeasonStore.getState().setActiveMonth(null);
    expect(useNextSeasonStore.getState().activeMonth).toBeNull();
  });

  it("应该能通过 reset 恢复初始状态", () => {
    useNextSeasonStore.getState().setData(mockData);
    useNextSeasonStore.getState().setActiveMonth(10);
    useNextSeasonStore.getState().reset();
    expect(useNextSeasonStore.getState()).toMatchObject({
      data: [],
      activeMonth: null,
    });
  });
});

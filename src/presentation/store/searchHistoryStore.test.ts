import { afterEach, describe, expect, it } from "vitest";
import { useSearchHistoryStore } from "./searchHistoryStore";

describe("搜索历史状态 store", () => {
  afterEach(() => {
    useSearchHistoryStore.getState().reset();
  });

  it("应该提供默认初始状态", () => {
    const state = useSearchHistoryStore.getState();
    expect(state.history).toEqual([]);
  });

  it("应该能添加搜索历史，并且新搜索词排在最前面并去重", () => {
    const store = useSearchHistoryStore.getState();
    store.addHistory("鬼灭之刃");
    expect(useSearchHistoryStore.getState().history).toEqual(["鬼灭之刃"]);

    store.addHistory("咒术回战");
    expect(useSearchHistoryStore.getState().history).toEqual([
      "咒术回战",
      "鬼灭之刃",
    ]);

    // 重复添加应该移到最前
    store.addHistory("鬼灭之刃");
    expect(useSearchHistoryStore.getState().history).toEqual([
      "鬼灭之刃",
      "咒术回战",
    ]);
  });

  it("应该能删除指定历史记录", () => {
    const store = useSearchHistoryStore.getState();
    store.addHistory("鬼灭之刃");
    store.addHistory("咒术回战");
    expect(useSearchHistoryStore.getState().history).toEqual([
      "咒术回战",
      "鬼灭之刃",
    ]);

    store.deleteHistory("鬼灭之刃");
    expect(useSearchHistoryStore.getState().history).toEqual(["咒术回战"]);
  });

  it("应该能清空所有搜索历史", () => {
    const store = useSearchHistoryStore.getState();
    store.addHistory("鬼灭之刃");
    store.addHistory("咒术回战");
    expect(useSearchHistoryStore.getState().history.length).toBe(2);

    store.clearHistory();
    expect(useSearchHistoryStore.getState().history).toEqual([]);
  });

  it("应该能通过 reset 恢复初始状态", () => {
    const store = useSearchHistoryStore.getState();
    store.addHistory("鬼灭之刃");
    store.reset();
    expect(useSearchHistoryStore.getState().history).toEqual([]);
  });
});

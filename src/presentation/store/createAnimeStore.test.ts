import { describe, expect, it } from "vitest";
import { createAnimeStore } from "./createAnimeStore";

interface TestState {
  name: string;
  count: number;
  enabled: boolean;
}

const useTestStore = createAnimeStore<TestState>({
  name: "",
  count: 0,
  enabled: false,
});

describe("createAnimeStore 工厂函数", () => {
  it("应该创建包含默认状态的 store", () => {
    const state = useTestStore.getState();
    expect(state.name).toBe("");
    expect(state.count).toBe(0);
    expect(state.enabled).toBe(false);
  });

  it("应该为每个字段自动生成 setter 方法", () => {
    const state = useTestStore.getState();

    state.setName("test");
    expect(useTestStore.getState().name).toBe("test");

    state.setCount(42);
    expect(useTestStore.getState().count).toBe(42);

    state.setEnabled(true);
    expect(useTestStore.getState().enabled).toBe(true);
  });

  it("setter 名称首字母应大写", () => {
    const state = useTestStore.getState();
    expect(typeof state.setName).toBe("function");
    expect(typeof state.setCount).toBe("function");
    expect(typeof state.setEnabled).toBe("function");
  });

  it("应该提供 reset 方法恢复默认状态", () => {
    const state = useTestStore.getState();
    state.setName("modified");
    state.setCount(99);
    state.setEnabled(true);

    state.reset();

    const resetState = useTestStore.getState();
    expect(resetState.name).toBe("");
    expect(resetState.count).toBe(0);
    expect(resetState.enabled).toBe(false);
  });

  it("多个 setter 可以连续调用", () => {
    const state = useTestStore.getState();
    state.setName("a");
    state.setCount(1);
    state.setEnabled(true);

    const updated = useTestStore.getState();
    expect(updated.name).toBe("a");
    expect(updated.count).toBe(1);
    expect(updated.enabled).toBe(true);

    updated.reset();
  });
});

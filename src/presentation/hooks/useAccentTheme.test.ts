import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  ACCENT_STORAGE_KEY,
  applyAccent,
  getStoredAccent,
  isAccentId,
  useAccentTheme,
} from "./useAccentTheme";

describe("useAccentTheme 主色主题 hook", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.accent;
  });

  it("未存储任何主色时应该默认返回 indigo", () => {
    expect(getStoredAccent()).toBe("indigo");
    expect(isAccentId("indigo")).toBe(true);
    expect(isAccentId("unknown")).toBe(false);
  });

  it("存储了合法主色时应该读取该主色", () => {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, "emerald");
    expect(getStoredAccent()).toBe("emerald");
  });

  it("存储了非法主色时应该回退到 indigo", () => {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, "purple");
    expect(getStoredAccent()).toBe("indigo");
  });

  it("挂载时应该将主色应用到 html 的 data-accent 属性", () => {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, "rose");
    const { result } = renderHook(() => useAccentTheme());

    expect(result.current.accent).toBe("rose");
    expect(document.documentElement.dataset.accent).toBe("rose");
  });

  it("setAccent 应该同步更新状态、localStorage 与 html 属性", () => {
    const { result } = renderHook(() => useAccentTheme());

    act(() => {
      result.current.setAccent("amber");
    });

    expect(result.current.accent).toBe("amber");
    expect(window.localStorage.getItem(ACCENT_STORAGE_KEY)).toBe("amber");
    expect(document.documentElement.dataset.accent).toBe("amber");
  });

  it("applyAccent 应该直接设置 html 的 data-accent 属性", () => {
    applyAccent("sky");
    expect(document.documentElement.dataset.accent).toBe("sky");
  });
});

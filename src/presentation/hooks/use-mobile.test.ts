import { renderHook } from "@testing-library/react";
import { useIsMobile } from "./use-mobile";

describe("useIsMobile", () => {
  it("在桌面宽度下返回 false", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("在移动端宽度下返回 true", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 375,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });
});

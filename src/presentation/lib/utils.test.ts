import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn tailwind class 合并工具", () => {
  it("应合并多个 class", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("应过滤 falsy 值", () => {
    expect(cn("a", false, null, undefined, 0, "b")).toBe("a b");
  });

  it("冲突的 tailwind class 应保留后者", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

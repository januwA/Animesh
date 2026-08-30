import { describe, expect, it } from "vitest";
import { LogLevel, LogPriority } from "./logger";

describe("LogLevel", () => {
  it("应该定义正确的字符串值", () => {
    expect(LogLevel.DEBUG).toBe("debug");
    expect(LogLevel.INFO).toBe("info");
    expect(LogLevel.WARN).toBe("warn");
    expect(LogLevel.ERROR).toBe("error");
  });
});

describe("LogPriority", () => {
  it("应该为每个级别分配唯一优先级", () => {
    expect(LogPriority[LogLevel.DEBUG]).toBe(0);
    expect(LogPriority[LogLevel.INFO]).toBe(1);
    expect(LogPriority[LogLevel.WARN]).toBe(2);
    expect(LogPriority[LogLevel.ERROR]).toBe(3);
  });

  it("优先级应严格递增", () => {
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ];
    for (let i = 1; i < levels.length; i++) {
      expect(LogPriority[levels[i]]).toBeGreaterThan(
        LogPriority[levels[i - 1]],
      );
    }
  });
});

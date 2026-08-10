import { describe, expect, it, vi } from "vitest";
import {
  createThrottleByChange,
  formatBytes,
  formatError,
  formatLocalDate,
  formatPlaybackTime,
} from "./utils";

describe("节流函数 createThrottleByChange", () => {
  it("首次执行应该被放行", () => {
    const throttle = createThrottleByChange<number>(3000);
    expect(throttle.run(400, 0)).toBe(true);
  });

  it("在节流间隔内即使 key 变化也不应该放行", () => {
    const throttle = createThrottleByChange<number>(3000);
    expect(throttle.run(400, 0)).toBe(true);
    expect(throttle.run(450, 1000)).toBe(false);
    expect(throttle.run(500, 2999)).toBe(false);
  });

  it("到达节流间隔边界时应该放行", () => {
    const throttle = createThrottleByChange<number>(3000);
    expect(throttle.run(400, 0)).toBe(true);
    expect(throttle.run(450, 3000)).toBe(true);
  });

  it("超过节流间隔但 key 未变化时不应该放行", () => {
    const throttle = createThrottleByChange<number>(3000);
    expect(throttle.run(400, 0)).toBe(true);
    expect(throttle.run(400, 4000)).toBe(false);
  });

  it("超过节流间隔且 key 变化时应该放行", () => {
    const throttle = createThrottleByChange<number>(3000);
    expect(throttle.run(400, 0)).toBe(true);
    expect(throttle.run(450, 4000)).toBe(true);
  });

  it("reset 后应该立即放行", () => {
    const throttle = createThrottleByChange<number>(3000);
    expect(throttle.run(400, 0)).toBe(true);
    expect(throttle.run(450, 1000)).toBe(false);
    throttle.reset();
    expect(throttle.run(450, 1000)).toBe(true);
  });
});

describe("格式化字节大小函数 formatBytes", () => {
  it("应该正确格式化字节数为可读字符串", () => {
    expect(formatBytes(null)).toBe("未知大小");
    expect(formatBytes(undefined)).toBe("未知大小");
    expect(formatBytes(0)).toBe("未知大小");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(1073741824)).toBe("1 GB");
  });
});

describe("格式化本地时间函数 formatLocalDate", () => {
  it("应该正确将符合规范的日期字符串格式化为本地时间字符串 YYYY-MM-DD HH:mm:ss", () => {
    const input = "Mon, 23 Jun 2026 12:00:00 +0800";
    const result = formatLocalDate(input);

    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

    const expectedDate = new Date(input);
    const pad = (n: number) => String(n).padStart(2, "0");
    const expectedStr = `${expectedDate.getFullYear()}-${pad(
      expectedDate.getMonth() + 1,
    )}-${pad(expectedDate.getDate())} ${pad(expectedDate.getHours())}:${pad(
      expectedDate.getMinutes(),
    )}:${pad(expectedDate.getSeconds())}`;

    expect(result).toBe(expectedStr);
  });

  it("当输入空字符串或无效日期时，应该原样返回或返回空", () => {
    expect(formatLocalDate("")).toBe("");
    expect(formatLocalDate("invalid-date")).toBe("invalid-date");
  });

  it("应该将今天的日期格式化为 今天 HH:mm:ss", () => {
    vi.useFakeTimers();
    const now = new Date("2026-08-06T10:11:12");
    vi.setSystemTime(now);
    try {
      const result = formatLocalDate(now);
      expect(result).toBe("今天 10:11:12");
    } finally {
      vi.useRealTimers();
    }
  });

  it("应该将昨天的日期格式化为 昨天 HH:mm:ss", () => {
    vi.useFakeTimers();
    const now = new Date("2026-08-06T10:11:12");
    vi.setSystemTime(now);
    try {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const result = formatLocalDate(yesterday);
      expect(result).toBe("昨天 10:11:12");
    } finally {
      vi.useRealTimers();
    }
  });

  it("应该将前天的日期格式化为 前天 HH:mm:ss", () => {
    vi.useFakeTimers();
    const now = new Date("2026-08-06T10:11:12");
    vi.setSystemTime(now);
    try {
      const dayBeforeYesterday = new Date(now);
      dayBeforeYesterday.setDate(now.getDate() - 2);
      const result = formatLocalDate(dayBeforeYesterday);
      expect(result).toBe("前天 10:11:12");
    } finally {
      vi.useRealTimers();
    }
  });

  it("应该将三天前的日期格式化为完整日期字符串", () => {
    vi.useFakeTimers();
    const now = new Date("2026-08-06T10:11:12");
    vi.setSystemTime(now);
    try {
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(now.getDate() - 3);
      const result = formatLocalDate(threeDaysAgo);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} 10:11:12$/);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("格式化播放时长函数 formatPlaybackTime", () => {
  it("应格式化为 HH:mm:ss", () => {
    expect(formatPlaybackTime(0)).toBe("00:00:00");
    expect(formatPlaybackTime(1000)).toBe("00:00:01");
    expect(formatPlaybackTime(61000)).toBe("00:01:01");
    expect(formatPlaybackTime(3600000)).toBe("01:00:00");
    expect(formatPlaybackTime(3661000)).toBe("01:01:01");
    expect(formatPlaybackTime(90061000)).toBe("25:01:01");
  });

  it("应处理负数或无效输入为 00:00:00", () => {
    expect(formatPlaybackTime(-1000)).toBe("00:00:00");
    expect(formatPlaybackTime(Number.NaN)).toBe("00:00:00");
    expect(formatPlaybackTime(Number.POSITIVE_INFINITY)).toBe("00:00:00");
  });
});

describe("格式化错误对象函数 formatError", () => {
  it("应该正确处理非 Error 类型的错误", () => {
    expect(formatError("网络连接失败")).toBe("网络连接失败");
    expect(formatError(404)).toBe("404");
    expect(formatError(null)).toBe("null");
    expect(formatError(undefined)).toBe("undefined");
  });

  it("应该正确处理普通 Error 对象", () => {
    const err = new Error("请求超时");
    expect(formatError(err)).toBe("请求超时");
  });

  it("应该正确处理带有单层 cause 的 Error 对象", () => {
    const cause = new Error("连接重置");
    const err = new Error("请求失败", { cause });
    expect(formatError(err)).toBe("请求失败 -> 连接重置");
  });

  it("应该正确处理带有嵌套多层 cause 的 Error 对象", () => {
    const causeOfCause = new Error("DNS 解析失败");
    const cause = new Error("无法连接到服务器", { cause: causeOfCause });
    const err = new Error("初始化失败", { cause });
    expect(formatError(err)).toBe(
      "初始化失败 -> 无法连接到服务器 -> DNS 解析失败",
    );
  });

  it("应该正确处理 cause 为非 Error 类型的情况", () => {
    const err = new Error("读取文件失败", { cause: "文件不存在" });
    expect(formatError(err)).toBe("读取文件失败 -> 文件不存在");
  });

  it("应该正确处理循环引用的 cause 对象以防止死循环", () => {
    const err1 = new Error("错误1");
    const err2 = new Error("错误2", { cause: err1 });
    err1.cause = err2; // 制造循环引用
    expect(formatError(err1)).toBe("错误1 -> 错误2 -> 错误1");
  });
});

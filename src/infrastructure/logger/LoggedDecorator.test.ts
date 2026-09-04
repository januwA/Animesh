import type { Context } from "ajanuw-context";
import { beforeEach, describe, expect, it, type Mocked, vi } from "vitest";
import { TRACE_ID } from "@/domain/common/ContextKeys";
import { type Logger, LogLevel } from "@/domain/logger/logger";
import { Logged } from "./LoggedDecorator";

function createMockLogger(): Mocked<Logger> {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withCategory: vi.fn().mockReturnThis(),
  } as Mocked<Logger>;
}

function createMockContext(traceId?: string): Context {
  return {
    deadline: vi.fn(() => [new Date(0), false] as [Date, boolean]),
    done: vi.fn(() => new Promise<void>(() => {})),
    err: vi.fn(() => null),
    value: vi.fn((key: unknown) =>
      key === TRACE_ID ? (traceId ?? null) : null,
    ) as Context["value"],
  };
}

describe("Logged 装饰器", () => {
  let mockLogger: Mocked<Logger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  describe("当 logger 存在时", () => {
    it("成功调用应记录入口和出口日志", async () => {
      class TestService {
        logger?: Logger = mockLogger;

        @Logged()
        async fetchData(id: string): Promise<string> {
          return `data-${id}`;
        }
      }

      const service = new TestService();
      const result = await service.fetchData("42");

      expect(result).toBe("data-42");
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[[0-9a-f]{8}\] TestService\.fetchData\(\) called$/,
        ),
        ["42"],
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[[0-9a-f]{8}\] TestService\.fetchData\(\) → [\d.]+ms$/,
        ),
        "data-42",
      );
    });

    it("应记录正确的执行时间", async () => {
      class TestService {
        logger?: Logger = mockLogger;

        @Logged()
        async slowMethod(): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      const service = new TestService();
      await service.slowMethod();

      const exitCall = mockLogger.debug.mock.calls[1][0];
      const duration = Number.parseFloat(
        exitCall.match(/→ ([\d.]+)ms$/)?.[1] ?? "0",
      );
      expect(duration).toBeGreaterThanOrEqual(40);
    });

    it("excludeArgs 应排除指定索引的参数，其余参数仍记录", async () => {
      class TestService {
        logger?: Logger = mockLogger;

        @Logged({ excludeArgs: [0, 2] })
        async fetchData(
          id: string,
          _scope: string,
          _trace: string,
        ): Promise<string> {
          return `data-${id}`;
        }
      }

      const service = new TestService();
      await service.fetchData("42", "global", "trace-123");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[[0-9a-f]{8}\] TestService\.fetchData\(\) called$/,
        ),
        ["global"],
      );
    });

    it("失败调用应记录错误日志并重新抛出异常", async () => {
      class TestService {
        logger?: Logger = mockLogger;

        @Logged()
        async failingMethod(): Promise<string> {
          throw new Error("boom");
        }
      }

      const service = new TestService();
      await expect(service.failingMethod()).rejects.toThrow("boom");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[[0-9a-f]{8}\] TestService\.failingMethod\(\) called$/,
        ),
        [],
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[[0-9a-f]{8}\] TestService\.failingMethod\(\) → error after [\d.]+ms$/,
        ),
        expect.objectContaining({ message: "boom" }),
      );
    });

    it("自定义 level 应使用对应日志级别", async () => {
      class TestService {
        logger?: Logger = mockLogger;

        @Logged({ level: LogLevel.INFO })
        async fetchData(): Promise<string> {
          return "ok";
        }
      }

      const service = new TestService();
      await service.fetchData();

      expect(mockLogger.info).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe("同步函数支持", () => {
    it("应正确装饰同步函数并记录日志", () => {
      class TestService {
        logger?: Logger = mockLogger;

        @Logged()
        appendParams(url: string, params?: Record<string, string>): string {
          if (!params) return url;
          const query = Object.entries(params)
            .map(([k, v]) => `${k}=${v}`)
            .join("&");
          return `${url}?${query}`;
        }
      }

      const service = new TestService();
      const result = service.appendParams("https://api.example.com", {
        page: "1",
      });

      expect(result).toBe("https://api.example.com?page=1");
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[[0-9a-f]{8}\] TestService\.appendParams\(\) called$/,
        ),
        ["https://api.example.com", { page: "1" }],
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[[0-9a-f]{8}\] TestService\.appendParams\(\) → [\d.]+ms$/,
        ),
        "https://api.example.com?page=1",
      );
    });

    it("同步函数无参数时应记录空参数", () => {
      class TestService {
        logger?: Logger = mockLogger;

        @Logged()
        getTimestamp(): number {
          return Date.now();
        }
      }

      const service = new TestService();
      const result = service.getTimestamp();

      expect(typeof result).toBe("number");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[[0-9a-f]{8}\] TestService\.getTimestamp\(\) called$/,
        ),
        [],
      );
    });

    it("同步函数抛出异常应记录错误日志", () => {
      class TestService {
        logger?: Logger = mockLogger;

        @Logged()
        failingSync(): string {
          throw new Error("sync error");
        }
      }

      const service = new TestService();
      expect(() => service.failingSync()).toThrow("sync error");
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[[0-9a-f]{8}\] TestService\.failingSync\(\) → error after [\d.]+ms$/,
        ),
        expect.objectContaining({ message: "sync error" }),
      );
    });

    it("同步函数应保持返回值类型不变", () => {
      class TestService {
        logger?: Logger = mockLogger;

        @Logged()
        calculate(a: number, b: number): number {
          return a + b;
        }
      }

      const service = new TestService();
      const result = service.calculate(1, 2);

      expect(result).toBe(3);
      expect(typeof result).toBe("number");
    });
  });

  describe("当 logger 不存在时", () => {
    it("应直接调用原方法，不报错不阻塞", async () => {
      class TestService {
        logger?: Logger = undefined;

        @Logged()
        async fetchData(id: string): Promise<string> {
          return `data-${id}`;
        }
      }

      const service = new TestService();
      const result = await service.fetchData("42");

      expect(result).toBe("data-42");
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe("traceId 作为 opId", () => {
    it("args 中包含 Context 且有 traceId 时，应使用 traceId 作为 opId", async () => {
      class TestService {
        logger?: Logger = mockLogger;

        @Logged()
        async fetchData(_ctx: Context, id: string): Promise<string> {
          return `data-${id}`;
        }
      }

      const service = new TestService();
      const ctx = createMockContext("abc-123-trace");
      await service.fetchData(ctx, "42");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[abc-123-trace] TestService.fetchData() called",
        ["42"],
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("[abc-123-trace] TestService.fetchData() →"),
        "data-42",
      );
    });

    it("args 中包含 Context 但无 traceId 时，应回退到随机 UUID", async () => {
      class TestService {
        logger?: Logger = mockLogger;

        @Logged()
        async fetchData(_ctx: Context, id: string): Promise<string> {
          return `data-${id}`;
        }
      }

      const service = new TestService();
      const ctx = createMockContext(undefined);
      await service.fetchData(ctx, "42");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[[0-9a-f]{8}\] TestService\.fetchData\(\) called$/,
        ),
        ["42"],
      );
    });

    it("args 中不包含 Context 时，应使用随机 UUID", async () => {
      class TestService {
        logger?: Logger = mockLogger;

        @Logged()
        async fetchData(id: string): Promise<string> {
          return `data-${id}`;
        }
      }

      const service = new TestService();
      await service.fetchData("42");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[[0-9a-f]{8}\] TestService\.fetchData\(\) called$/,
        ),
        ["42"],
      );
    });

    it("Context 不在第一个参数位置时也能正确识别并排除", async () => {
      class TestService {
        logger?: Logger = mockLogger;

        @Logged()
        async fetchData(
          id: string,
          _name: string,
          _ctx: Context,
        ): Promise<string> {
          return `data-${id}`;
        }
      }

      const service = new TestService();
      const ctx = createMockContext("late-ctx-id");
      await service.fetchData("42", "test", ctx);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[late-ctx-id] TestService.fetchData() called",
        ["42", "test"],
      );
    });

    it("检测到 Context 后应自动从日志参数中排除", async () => {
      class TestService {
        logger?: Logger = mockLogger;

        @Logged()
        async fetchData(
          _ctx: Context,
          id: string,
          _name: string,
        ): Promise<string> {
          return `data-${id}`;
        }
      }

      const service = new TestService();
      const ctx = createMockContext("auto-exclude-test");
      await service.fetchData(ctx, "42", "test");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[auto-exclude-test] TestService.fetchData() called",
        ["42", "test"],
      );
    });

    it("自动排除 Context 不影响手动 excludeArgs 的叠加使用", async () => {
      class TestService {
        logger?: Logger = mockLogger;

        @Logged({ excludeArgs: [2] })
        async fetchData(
          _ctx: Context,
          id: string,
          _name: string,
        ): Promise<string> {
          return `data-${id}`;
        }
      }

      const service = new TestService();
      const ctx = createMockContext("combo-test");
      await service.fetchData(ctx, "42", "test");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[combo-test] TestService.fetchData() called",
        ["42"],
      );
    });
  });
});

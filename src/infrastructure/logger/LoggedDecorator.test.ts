import { beforeEach, describe, expect, it, type Mocked, vi } from "vitest";
import type { Logger } from "@/domain/logger/logger";
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

        @Logged({ level: "info" })
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
});

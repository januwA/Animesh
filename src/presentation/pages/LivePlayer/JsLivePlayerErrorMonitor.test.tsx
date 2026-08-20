import { act, render } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "@/domain/logger/logger";
import { JsLivePlayerErrorMonitor } from "./JsLivePlayerErrorMonitor";

const createTestLogger = (): Logger & { error: ReturnType<typeof vi.fn> } => {
  const log = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withCategory: () => log,
  };
  return log;
};

describe("JsLivePlayerErrorMonitor 直播错误监控组件", () => {
  let logger: Logger & { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logger = createTestLogger();
  });

  afterEach(() => {
    (globalThis as any).__vjsMock.setError(null);
  });

  const triggerError = (code: number) => {
    const vjsMock = (globalThis as any).__vjsMock;
    act(() => {
      vjsMock.setError({ code } as MediaError);
      vjsMock.trigger();
    });
  };

  it("应该渲染为空组件（返回 null）", () => {
    const { container } = render(
      <JsLivePlayerErrorMonitor logger={logger} onRecover={vi.fn()} />,
    );

    expect(container.firstChild).toBeNull();
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });

  it.each([4, 3, 2, 1])(
    "错误码 %i 时应该提示对应的错误信息并记录日志",
    (code) => {
      const onRecover = vi.fn();
      render(
        <JsLivePlayerErrorMonitor logger={logger} onRecover={onRecover} />,
      );

      triggerError(code);

      const messages: Record<number, string> = {
        4: "当前浏览器不支持播放该直播源。",
        3: "直播流解码失败，可能源地址已失效或编码不支持。",
        2: "直播流加载超时或网络断开。",
      };
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        messages[code] ?? "直播流加载失败",
        { duration: 8000 },
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Live video element error:",
        expect.anything(),
      );
      if (code === 2 || code === 3) {
        expect(onRecover).toHaveBeenCalled();
      } else {
        expect(onRecover).not.toHaveBeenCalled();
      }
    },
  );
});

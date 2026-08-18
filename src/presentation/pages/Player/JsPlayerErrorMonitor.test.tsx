import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import type { Logger } from "@/domain/logger/logger";
import { createDIContainerForTest } from "@/test/test-utils";
import { JsPlayerErrorMonitor } from "./JsPlayerErrorMonitor";
import { JsPlayer } from "./player";

const wrapWithProviders = (node: ReactNode, container: DIContainer) => (
  <DIProvider value={container}>
    <JsPlayer.Provider>{node}</JsPlayer.Provider>
  </DIProvider>
);

describe("JsPlayerErrorMonitor 播放器错误监控组件", () => {
  let container: DIContainer;
  let logger: Logger;

  const createTestLogger = (): Logger => {
    const log: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      withCategory: () => log,
    };
    return log;
  };

  beforeEach(() => {
    logger = createTestLogger();
    container = createDIContainerForTest({ logger });
  });

  afterEach(() => {
    const vjsMock = (globalThis as any).__vjsMock;
    vjsMock.setError(null);
  });

  const triggerError = (code: number) => {
    const vjsMock = (globalThis as any).__vjsMock;
    act(() => {
      vjsMock.setError({ code } as MediaError);
      vjsMock.trigger();
    });
  };

  it("没有错误时应该渲染为空且不提示", () => {
    const { container: host } = render(
      wrapWithProviders(<JsPlayerErrorMonitor />, container),
    );
    expect(host.innerHTML).toBe("");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each([4, 3, 2, 1, 0])("错误码 %i 时应该提示对应错误信息", (code) => {
    render(wrapWithProviders(<JsPlayerErrorMonitor />, container));
    const vjsMock = (globalThis as any).__vjsMock;
    const setErrorSpy = vi.spyOn(vjsMock, "setError");

    triggerError(code);

    const messages: Record<number, string> = {
      4: "当前浏览器不支持播放该格式（例如 MKV 容器），建议点击上方按钮“用系统播放器播放”。",
      3: "视频解码失败，可能数据已损坏或编码不支持。",
      2: "视频加载超时或网络断开。",
    };
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      messages[code] ?? "视频加载失败",
      { duration: 8000 },
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Video element error:",
      expect.anything(),
    );
    expect(setErrorSpy).toHaveBeenCalledWith(null);
  });
});

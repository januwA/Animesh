import { act, renderHook, waitFor } from "@testing-library/react";
import { Canceled } from "ajanuw-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStream } from "./useStream";

function createMockStream<T>() {
  let controller: ReadableStreamDefaultController<T>;
  const stream = new ReadableStream<T>({
    start(c) {
      controller = c;
    },
  });
  let closed = false;
  return {
    stream,
    push: (value: T) => {
      if (!closed) controller.enqueue(value);
    },
    close: () => {
      if (closed) return;
      closed = true;
      controller.close();
    },
    error: (err: unknown) => {
      if (closed) return;
      closed = true;
      controller.error(err);
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function suppressUnhandledRejections() {
  const handler = (e: PromiseRejectionEvent) => {
    e.preventDefault();
  };
  beforeEach(() => {
    window.addEventListener("unhandledrejection", handler);
  });
  afterEach(() => {
    window.removeEventListener("unhandledrejection", handler);
  });
}

describe("useStream 流订阅 hook", () => {
  it("初始状态应该为 status=idle 且 data 为 null", () => {
    const { promise } = deferred<ReadableStream<string>>();
    const { result } = renderHook(() => useStream(() => promise, []));

    expect(result.current.status).toBe("connecting");
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("建立连接后应该更新 status 为 open", async () => {
    const mock = createMockStream<string>();
    const { result } = renderHook(() =>
      useStream(() => Promise.resolve(mock.stream), []),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });
  });

  it("收到数据后应该更新 data", async () => {
    const mock = createMockStream<string>();
    const { result } = renderHook(() =>
      useStream(() => Promise.resolve(mock.stream), []),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    act(() => {
      mock.push("第一条消息");
    });

    await waitFor(() => {
      expect(result.current.data).toBe("第一条消息");
    });

    act(() => {
      mock.push("第二条消息");
    });

    await waitFor(() => {
      expect(result.current.data).toBe("第二条消息");
    });
  });

  it("流关闭后应该更新 status 为 closed", async () => {
    const mock = createMockStream<string>();
    const { result } = renderHook(() =>
      useStream(() => Promise.resolve(mock.stream), []),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    act(() => {
      mock.close();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("closed");
    });
  });

  describe("流错误处理", () => {
    suppressUnhandledRejections();

    it("流错误时应该设置 error", async () => {
      const mock = createMockStream<string>();
      const { result } = renderHook(() =>
        useStream(() => Promise.resolve(mock.stream), []),
      );

      await waitFor(() => {
        expect(result.current.status).toBe("open");
      });

      act(() => {
        mock.error(new Error("连接断开"));
      });

      await waitFor(() => {
        expect(result.current.error?.message).toBe("连接断开");
      });
    });

    it("onError 回调应该在流错误时触发", async () => {
      const onError = vi.fn();
      const mock = createMockStream<string>();

      const { result } = renderHook(() =>
        useStream(() => Promise.resolve(mock.stream), [], { onError }),
      );

      await waitFor(() => {
        expect(result.current.status).toBe("open");
      });

      act(() => {
        mock.error(new Error("测试错误"));
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(onError.mock.calls[0][0].message).toBe("测试错误");
      });
    });
  });

  it("streamFn 失败时应该设置 error", async () => {
    const { result } = renderHook(() =>
      useStream(() => Promise.reject(new Error("连接失败")), []),
    );

    await waitFor(() => {
      expect(result.current.error?.message).toBe("连接失败");
    });
    expect(result.current.status).toBe("closed");
  });

  it("enabled 为 false 时不应该建立连接", () => {
    const streamFn = vi.fn(() => Promise.resolve(new ReadableStream()));

    const { result } = renderHook(() =>
      useStream(streamFn, [], { enabled: false }),
    );

    expect(streamFn).not.toHaveBeenCalled();
    expect(result.current.status).toBe("closed");
  });

  it("enabled 从 false 变为 true 时应该自动建立连接", async () => {
    const mock = createMockStream<string>();
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useStream(() => Promise.resolve(mock.stream), [], { enabled }),
      { initialProps: { enabled: false } },
    );

    expect(result.current.status).toBe("closed");

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });
  });

  it("依赖变化时应该重新建立连接", async () => {
    const mock1 = createMockStream<string>();
    const mock2 = createMockStream<string>();
    const streamFn = vi.fn(
      (id: number) =>
        Promise.resolve(id === 1 ? mock1.stream : mock2.stream) as Promise<
          ReadableStream<string>
        >,
    );

    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useStream(() => streamFn(id), [id]),
      { initialProps: { id: 1 } },
    );

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    act(() => {
      mock1.push("旧数据");
    });

    await waitFor(() => {
      expect(result.current.data).toBe("旧数据");
    });

    rerender({ id: 2 });

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    act(() => {
      mock2.push("新数据");
    });

    await waitFor(() => {
      expect(result.current.data).toBe("新数据");
    });
  });

  it("refetch 应该重新建立连接", async () => {
    const mock = createMockStream<string>();
    const streamFn = vi.fn(() => Promise.resolve(mock.stream));

    const { result } = renderHook(() => useStream(streamFn, []));

    await waitFor(() => {
      expect(streamFn).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(streamFn).toHaveBeenCalledTimes(2);
    });
  });

  it("组件卸载时应该关闭流", async () => {
    const mock = createMockStream<string>();
    const streamFn = vi.fn(() => Promise.resolve(mock.stream));
    const { unmount } = renderHook(() => useStream(streamFn, []));

    await waitFor(() => {
      expect(streamFn).toHaveBeenCalled();
    });

    unmount();
  });

  it("卸载后推送的数据应该被忽略", async () => {
    const mock = createMockStream<string>();
    const { result, unmount } = renderHook(() =>
      useStream(() => Promise.resolve(mock.stream), []),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    unmount();

    expect(result.current.data).toBeNull();
  });

  it("onOpen 回调应该在连接建立后触发", async () => {
    const onOpen = vi.fn();
    const mock = createMockStream<string>();

    renderHook(() =>
      useStream(() => Promise.resolve(mock.stream), [], { onOpen }),
    );

    await waitFor(() => {
      expect(onOpen).toHaveBeenCalledOnce();
    });
  });

  it("onData 回调应该在收到数据时触发", async () => {
    const onData = vi.fn();
    const mock = createMockStream<string>();

    const { result } = renderHook(() =>
      useStream(() => Promise.resolve(mock.stream), [], { onData }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    act(() => {
      mock.push("测试数据");
    });

    await waitFor(() => {
      expect(onData).toHaveBeenCalledWith("测试数据");
    });
  });

  it("onClose 回调应该在流关闭后触发", async () => {
    const onClose = vi.fn();
    const mock = createMockStream<string>();

    const { result } = renderHook(() =>
      useStream(() => Promise.resolve(mock.stream), [], { onClose }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    act(() => {
      mock.close();
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  it("非 Error 类型的异常应该被包装为 Error 对象", async () => {
    const { result } = renderHook(() =>
      useStream(() => Promise.reject("字符串错误"), []),
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("字符串错误");
  });

  it("组件卸载时应该取消未完成的 streamFn", async () => {
    const { promise } = deferred<ReadableStream<string>>();
    const queryFn = vi.fn((ctx: { err: () => unknown }) => {
      expect(ctx).toBeDefined();
      return promise.then(() => {
        expect(ctx.err()).toBe(Canceled);
        return new ReadableStream();
      });
    });

    const { unmount } = renderHook(() => useStream(queryFn, []));
    unmount();
  });

  it("close 应该设置 status 为 closed", async () => {
    const mock = createMockStream<string>();
    const { result } = renderHook(() =>
      useStream(() => Promise.resolve(mock.stream), []),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    act(() => {
      result.current.close();
    });

    expect(result.current.status).toBe("closed");
  });
});

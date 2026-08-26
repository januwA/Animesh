import { act, renderHook, waitFor } from "@testing-library/react";
import type { Context } from "ajanuw-context";
import { describe, expect, it, vi } from "vitest";
import { useStream } from "./useStream";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface MockReaderController<T> {
  resolve: (value: ReadableStreamReadResult<T>) => void;
  reject: (reason: unknown) => void;
}

interface MockStreamHandle<T> {
  stream: ReadableStream<T>;
  readerController: MockReaderController<T>;
}

function createMockStream<T>(): MockStreamHandle<T> {
  let readerController: MockReaderController<T> | null = null;

  const stream = {
    getReader: () => ({
      read: vi.fn(
        () =>
          new Promise<ReadableStreamReadResult<T>>((res, rej) => {
            readerController = { resolve: res, reject: rej };
          }),
      ),
      cancel: vi.fn(),
    }),
    cancel: vi.fn(),
  } as unknown as ReadableStream<T>;

  return {
    stream,
    get readerController() {
      return readerController!;
    },
  };
}

function createStreamFn<T>(stream: ReadableStream<T>) {
  return vi.fn((_ctx: Context) => Promise.resolve(stream));
}

describe("useStream 流订阅 hook", () => {
  it("enabled=true 时应建立连接并进入 open", async () => {
    const handle = createMockStream<string>();
    const streamFn = createStreamFn(handle.stream);
    const onOpen = vi.fn();

    const { result } = renderHook(() => useStream(streamFn, [], { onOpen }));

    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });
    expect(onOpen).toHaveBeenCalled();
  });

  it("初始状态 enabled=false 时应为 closed 且不调用 streamFn", () => {
    const streamFn = createStreamFn(null as unknown as ReadableStream<string>);

    const { result } = renderHook(() =>
      useStream(streamFn, [], { enabled: false }),
    );

    expect(result.current.status).toBe("closed");
    expect(streamFn).not.toHaveBeenCalled();
  });

  it("连接成功后 status 应变为 open 并触发 onOpen", async () => {
    const handle = createMockStream<string>();
    const streamFn = createStreamFn(handle.stream);
    const onOpen = vi.fn();

    renderHook(() => useStream(streamFn, [], { onOpen }));

    await waitFor(() => {
      expect(onOpen).toHaveBeenCalled();
    });
  });

  it("收到数据时应更新 data 并调用 onData", async () => {
    const handle = createMockStream<string>();
    const streamFn = createStreamFn(handle.stream);
    const onData = vi.fn();

    const { result } = renderHook(() => useStream(streamFn, [], { onData }));

    await waitFor(() => {
      expect(handle.readerController).not.toBeNull();
    });

    act(() => {
      handle.readerController.resolve({ value: "第一条数据", done: false });
    });

    await waitFor(() => {
      expect(result.current.data).toBe("第一条数据");
    });
    expect(onData).toHaveBeenCalledWith("第一条数据");
  });

  it("流正常关闭后 status 应变为 closed 并触发 onClose", async () => {
    const handle = createMockStream<string>();
    const streamFn = createStreamFn(handle.stream);
    const onClose = vi.fn();

    const { result } = renderHook(() => useStream(streamFn, [], { onClose }));

    await waitFor(() => {
      expect(handle.readerController).not.toBeNull();
    });

    act(() => {
      handle.readerController.resolve({ value: undefined, done: true });
    });

    await waitFor(() => {
      expect(result.current.status).toBe("closed");
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("reader.read 抛出错误时应设置 error 并调用 onError", async () => {
    const handle = createMockStream<string>();
    const streamFn = createStreamFn(handle.stream);
    const onError = vi.fn();

    const { result } = renderHook(() => useStream(streamFn, [], { onError }));

    await waitFor(() => {
      expect(handle.readerController).not.toBeNull();
    });

    act(() => {
      handle.readerController.reject(new Error("读取失败"));
    });

    await waitFor(() => {
      expect(result.current.error?.message).toBe("读取失败");
    });
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("streamFn 抛出异常时应设置 error 并调用 onError", async () => {
    const onError = vi.fn();
    const streamFn = vi.fn((_ctx: Context) =>
      Promise.reject(new Error("连接失败")),
    );

    const { result } = renderHook(() => useStream(streamFn, [], { onError }));

    await waitFor(() => {
      expect(result.current.error?.message).toBe("连接失败");
    });
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("streamFn 抛出非 Error 类型异常时应包装为 Error", async () => {
    const onError = vi.fn();
    const streamFn = vi.fn((_ctx: Context) => Promise.reject("字符串错误"));

    const { result } = renderHook(() => useStream(streamFn, [], { onError }));

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });
    expect(result.current.error?.message).toBe("字符串错误");
  });

  it("streamFn 抛出 undefined 异常时应包装为 Error", async () => {
    const streamFn = vi.fn((_ctx: Context) => Promise.reject(undefined));

    const { result } = renderHook(() => useStream(streamFn, []));

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });
    expect(result.current.error?.message).toBe("undefined");
  });

  it("reader.read 抛出非 Error 异常时应包装为 Error", async () => {
    const handle = createMockStream<string>();
    const streamFn = createStreamFn(handle.stream);
    const onError = vi.fn();

    const { result } = renderHook(() => useStream(streamFn, [], { onError }));

    await waitFor(() => {
      expect(handle.readerController).not.toBeNull();
    });

    act(() => {
      handle.readerController.reject(42);
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });
    expect(result.current.error?.message).toBe("42");
  });

  it("依赖变化时应关闭旧流并建立新流", async () => {
    const first = createMockStream<string>();
    const second = createMockStream<string>();
    let which = 1;
    const streamFn = vi.fn((_ctx: Context) => {
      const handle = which === 1 ? first : second;
      return Promise.resolve(handle.stream);
    });

    const { rerender } = renderHook(
      ({ keyword }: { keyword: string }) => useStream(streamFn, [keyword]),
      { initialProps: { keyword: "a" } },
    );

    await waitFor(() => {
      expect(first.readerController).not.toBeNull();
    });

    which = 2;
    rerender({ keyword: "b" });

    await waitFor(() => {
      expect(second.readerController).not.toBeNull();
    });
    expect(streamFn).toHaveBeenCalledTimes(2);
  });

  it("refetch 应触发重连", async () => {
    const handle = createMockStream<string>();
    const streamFn = createStreamFn(handle.stream);

    const { result } = renderHook(() => useStream(streamFn, []));

    await waitFor(() => {
      expect(handle.readerController).not.toBeNull();
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(streamFn).toHaveBeenCalledTimes(2);
    });
  });

  it("close 应将 status 设为 closed", async () => {
    const handle = createMockStream<string>();
    const streamFn = createStreamFn(handle.stream);

    const { result } = renderHook(() => useStream(streamFn, []));

    await waitFor(() => {
      expect(handle.readerController).not.toBeNull();
    });

    act(() => {
      result.current.close();
    });

    expect(result.current.status).toBe("closed");
  });

  it("enabled 从 false 变为 true 时应建立连接", async () => {
    const handle = createMockStream<string>();
    const streamFn = createStreamFn(handle.stream);

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useStream(streamFn, [], { enabled }),
      { initialProps: { enabled: false } },
    );

    expect(streamFn).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(handle.readerController).not.toBeNull();
    });
  });

  it("组件卸载时应取消 context", async () => {
    const handle = createMockStream<string>();
    let capturedCtx: Context | null = null;
    const streamFn = vi.fn((ctx: Context) => {
      capturedCtx = ctx;
      return Promise.resolve(handle.stream);
    });

    const { unmount } = renderHook(() => useStream(streamFn, []));

    await waitFor(() => {
      expect(handle.readerController).not.toBeNull();
    });

    unmount();

    expect(capturedCtx!.err()).not.toBeNull();
  });

  it("streamFn 解析时 context 已取消应跳过连接", async () => {
    const handle = createMockStream<string>();
    const { promise, resolve } = deferred<ReadableStream<string>>();

    const streamFn = vi.fn(() => promise);

    const { unmount } = renderHook(() => useStream(streamFn, []));

    // 卸载触发 cleanup：active = false, cancel(), reader?.cancel()
    unmount();

    // 此时 resolve stream，async IIFE 恢复后检查 active/ctx.err() 走 early return
    resolve(handle.stream);
    await act(async () => {});

    // stream.cancel() 应被调用（early return 路径）
    expect(handle.stream.cancel).toHaveBeenCalled();
  });

  it("多次收到数据时 data 应更新为最新值", async () => {
    const handle = createMockStream<string>();
    const streamFn = createStreamFn(handle.stream);

    const { result } = renderHook(() => useStream(streamFn, []));

    await waitFor(() => {
      expect(handle.readerController).not.toBeNull();
    });

    act(() => {
      handle.readerController.resolve({ value: "第一条", done: false });
    });

    await waitFor(() => {
      expect(result.current.data).toBe("第一条");
    });

    // 重新获取 readerController（下一次 read 调用）
    await waitFor(() => {
      expect(handle.readerController).not.toBeNull();
    });

    act(() => {
      handle.readerController.resolve({ value: "第二条", done: false });
    });

    await waitFor(() => {
      expect(result.current.data).toBe("第二条");
    });
  });
});

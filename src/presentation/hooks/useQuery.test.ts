import { act, renderHook, waitFor } from "@testing-library/react";
import { Canceled } from "ajanuw-context";
import { describe, expect, it, vi } from "vitest";
import { useQuery } from "./useQuery";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useQuery 数据查询 hook", () => {
  it("初始状态应该为 loading=true 且 data 为 null", () => {
    const { promise } = deferred<string>();
    const { result } = renderHook(() => useQuery(() => promise, []));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("请求成功后应该更新 data 并设置 loading=false", async () => {
    const { result } = renderHook(() =>
      useQuery(() => Promise.resolve("结果"), []),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data).toBe("结果");
    expect(result.current.error).toBeNull();
  });

  it("请求失败时应该设置 error 并保持 loading=false", async () => {
    const { result } = renderHook(() =>
      useQuery(() => Promise.reject(new Error("网络错误")), []),
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error?.message).toBe("网络错误");
    expect(result.current.loading).toBe(false);
  });

  it("依赖变化时应该自动重新发起请求", async () => {
    const queryFn = vi.fn((_ctx: unknown, id: number) =>
      Promise.resolve(`数据-${id}`),
    );

    const { result, rerender } = renderHook(
      ({ id }: { id: number }) =>
        useQuery(() => queryFn(undefined, id) as Promise<string>, [id]),
      { initialProps: { id: 1 } },
    );

    await waitFor(() => {
      expect(result.current.data).toBe("数据-1");
    });
    expect(queryFn).toHaveBeenCalledTimes(1);

    rerender({ id: 2 });

    await waitFor(() => {
      expect(result.current.data).toBe("数据-2");
    });
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("enabled 为 false 时不应该发起请求", () => {
    const queryFn = vi.fn(() => Promise.resolve("数据"));

    const { result } = renderHook(() =>
      useQuery(queryFn, [], { enabled: false }),
    );

    expect(queryFn).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("enabled 从 false 变为 true 时应该自动发起请求", async () => {
    const queryFn = vi.fn(() => Promise.resolve("数据"));

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useQuery(queryFn, [], { enabled }),
      { initialProps: { enabled: false } },
    );

    expect(queryFn).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.data).toBe("数据");
    });
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("refetch 应该手动重新发起请求", async () => {
    const queryFn = vi.fn(() => Promise.resolve("数据"));

    const { result } = renderHook(() => useQuery(queryFn, []));

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalledTimes(2);
    });
  });

  it("依赖快速变化时旧请求的返回结果应该被忽略", async () => {
    const first = deferred<string>();
    const second = deferred<string>();

    const { result, rerender } = renderHook(
      ({ id }: { id: number }) =>
        useQuery<string>(
          () => (id === 1 ? first.promise : second.promise),
          [id],
        ),
      { initialProps: { id: 1 } },
    );

    rerender({ id: 2 });

    act(() => {
      first.resolve("过期数据");
    });

    // 旧请求完成但不应覆盖新请求的状态
    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });
    expect(result.current.data).toBeNull();

    act(() => {
      second.resolve("最新数据");
    });

    await waitFor(() => {
      expect(result.current.data).toBe("最新数据");
    });
  });

  it("组件卸载时应该取消未完成的请求", async () => {
    const { promise } = deferred<string>();
    const queryFn = vi.fn((ctx: { err: () => unknown }) => {
      expect(ctx).toBeDefined();
      return promise.then(() => {
        expect(ctx.err()).toBe(Canceled);
        return "数据";
      });
    });

    const { unmount } = renderHook(() => useQuery(queryFn, []));
    unmount();
  });

  it("请求成功后应该触发 onSuccess 回调", async () => {
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useQuery(() => Promise.resolve("结果"), [], { onSuccess }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(onSuccess).toHaveBeenCalledWith("结果");
  });

  it("请求失败时应该触发 onError 回调", async () => {
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useQuery(() => Promise.reject(new Error("网络错误")), [], { onError }),
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0][0].message).toBe("网络错误");
  });
});

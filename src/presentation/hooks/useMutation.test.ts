import { act, renderHook } from "@testing-library/react";
import { Canceled, DeadlineExceeded } from "ajanuw-context";
import { Duration } from "ajanuw-duration";
import { describe, expect, it, vi } from "vitest";
import { useMutation } from "./useMutation";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useMutation 数据变更 hook", () => {
  it("初始状态应该为 loading=false 且 data 为 null", () => {
    const { result } = renderHook(() =>
      useMutation(() => Promise.resolve("结果")),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("execute 成功后应该更新 data 并设置 loading=false", async () => {
    const { result } = renderHook(() =>
      useMutation((_ctx: unknown, params: string) =>
        Promise.resolve(`保存-${params}`),
      ),
    );

    let resolved: string | null = null;
    await act(async () => {
      resolved = await result.current.execute("abc");
    });

    expect(resolved).toBe("保存-abc");
    expect(result.current.data).toBe("保存-abc");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("execute 失败时应该设置 error 并返回 null", async () => {
    const { result } = renderHook(() =>
      useMutation<string, void>(() => Promise.reject(new Error("保存失败"))),
    );

    let resolved: string | null = "初始值";
    await act(async () => {
      resolved = await result.current.execute();
    });

    expect(resolved).toBeNull();
    expect(result.current.error?.message).toBe("保存失败");
    expect(result.current.loading).toBe(false);
  });

  it("执行期间 loading 应该为 true", async () => {
    const { promise, resolve } = deferred<string>();
    const { result } = renderHook(() =>
      useMutation<string, void>(() => promise),
    );

    let executePromise: Promise<string | null>;
    act(() => {
      executePromise = result.current.execute();
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolve("结果");
      await executePromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it("execute 成功后应该触发 onSuccess 与 onSettled 回调", async () => {
    const onSuccess = vi.fn();
    const onSettled = vi.fn();

    const { result } = renderHook(() =>
      useMutation(
        (_ctx: unknown, params: number) => Promise.resolve(params * 2),
        { onSuccess, onSettled },
      ),
    );

    await act(async () => {
      await result.current.execute(21);
    });

    expect(onSuccess).toHaveBeenCalledWith(42, 21);
    expect(onSettled).toHaveBeenCalledWith(42, null, 21);
  });

  it("execute 失败时应该触发 onError 与 onSettled 回调", async () => {
    const onError = vi.fn();
    const onSettled = vi.fn();

    const { result } = renderHook(() =>
      useMutation<string, void>(() => Promise.reject(new Error("失败")), {
        onError,
        onSettled,
      }),
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error), undefined);
    expect(onError.mock.calls[0][0].message).toBe("失败");
    expect(onSettled).toHaveBeenCalledWith(null, expect.any(Error), undefined);
  });

  it("新的 execute 应该取消上一次未完成的请求", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const mutationFn = vi.fn((_ctx: { err: () => unknown }, id: number) =>
      id === 1 ? first.promise : second.promise,
    );

    const { result } = renderHook(() => useMutation(mutationFn));

    let firstResult: string | null | undefined;
    act(() => {
      result.current.execute(1).then((value) => {
        firstResult = value;
      });
    });
    act(() => {
      result.current.execute(2);
    });

    const firstContext = mutationFn.mock.calls[0][0];
    expect(firstContext.err()).toBe(Canceled);

    await act(async () => {
      first.resolve("过期结果");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // 被取消的请求不应影响当前状态
    expect(firstResult).toBeNull();
    expect(result.current.data).toBeNull();

    await act(async () => {
      second.resolve("最新结果");
    });
    expect(result.current.data).toBe("最新结果");
  });

  it("组件卸载时应该取消未完成的请求", async () => {
    const { promise } = deferred<string>();
    const mutationFn = vi.fn((_ctx: { err: () => unknown }) => promise);

    const { result, unmount } = renderHook(() => useMutation(mutationFn));

    act(() => {
      result.current.execute();
    });
    unmount();

    const capturedCtx = mutationFn.mock.calls[0][0];
    expect(capturedCtx.err()).toBe(Canceled);
  });

  it("cancel 应该取消当前请求并清空 loading 且不设置 error", async () => {
    const { promise, reject } = deferred<string>();
    const mutationFn = vi.fn((_ctx: { err: () => unknown }) => promise);

    const { result } = renderHook(() =>
      useMutation<string, void>(mutationFn, {
        onError: vi.fn(),
      }),
    );

    act(() => {
      result.current.execute();
    });
    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.cancel();
    });

    const capturedCtx = mutationFn.mock.calls[0][0];
    expect(capturedCtx.err()).toBe(Canceled);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();

    await act(async () => {
      reject(new Error("已取消"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // 取消后的失败不应触发 onError 或设置 error
    expect(result.current.error).toBeNull();
  });

  it("reset 应该重置 data / loading / error 状态", async () => {
    const { result } = renderHook(() =>
      useMutation<string, void>(() => Promise.reject(new Error("失败"))),
    );

    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("设置 timeout 后执行超时应取消 context 并触发 onError", async () => {
    const { promise } = deferred<string>();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useMutation<string, void>(
        (ctx) =>
          Promise.race([
            promise,
            ctx.done().then(() => {
              throw ctx.err()!;
            }),
          ]),
        {
          timeout: new Duration({ milliseconds: 50 }),
          onError,
        },
      ),
    );

    let resolved: string | null = null;
    act(() => {
      result.current.execute().then((value) => {
        resolved = value;
      });
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(resolved).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("context deadline exceeded");
    expect(onError).toHaveBeenCalledWith(expect.any(Error), undefined);
  });

  it("设置 timeout 后执行在超时前完成应正常返回数据", async () => {
    const { result } = renderHook(() =>
      useMutation<string, void>(() => Promise.resolve("成功"), {
        timeout: new Duration({ seconds: 5 }),
      }),
    );

    let resolved: string | null = null;
    await act(async () => {
      resolved = await result.current.execute();
    });

    expect(resolved).toBe("成功");
    expect(result.current.data).toBe("成功");
    expect(result.current.error).toBeNull();
  });

  it("设置 timeout 后超时应触发 ctx.err() 为 DeadlineExceeded", async () => {
    let capturedCtx: { err: () => unknown } | null = null;
    const { promise } = deferred<string>();

    const { result } = renderHook(() =>
      useMutation<string, void>(
        (ctx) => {
          capturedCtx = ctx;
          return promise;
        },
        { timeout: new Duration({ milliseconds: 50 }) },
      ),
    );

    act(() => {
      result.current.execute();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(capturedCtx!.err()).toBe(DeadlineExceeded);
  });

  it("设置 timeout 后多次 execute 应每次创建新的带超时 context", async () => {
    const { promise } = deferred<string>();
    const executeFns = vi.fn((_ctx: { err: () => unknown }) => promise);

    const { result } = renderHook(() =>
      useMutation(executeFns, {
        timeout: new Duration({ milliseconds: 100 }),
      }),
    );

    act(() => {
      result.current.execute();
    });

    const firstCtx = executeFns.mock.calls[0][0];

    // 取消第一次
    act(() => {
      result.current.cancel();
    });

    expect(firstCtx.err()).toBe(Canceled);

    // 第二次 execute 应该创建新的未取消 context
    act(() => {
      result.current.execute();
    });

    const secondCtx = executeFns.mock.calls[1][0];
    expect(secondCtx.err()).toBeNull();

    expect(executeFns).toHaveBeenCalledTimes(2);
  });
});

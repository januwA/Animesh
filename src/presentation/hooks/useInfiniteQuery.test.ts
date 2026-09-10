import { act, renderHook, waitFor } from "@testing-library/react";
import { Duration } from "ajanuw-duration";
import { describe, expect, it, vi } from "vitest";
import { useInfiniteQuery } from "./useInfiniteQuery";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface Page {
  items: { id: number }[];
  total: number;
}

function makePage(ids: number[], total: number): Page {
  return { items: ids.map((id) => ({ id })), total };
}

const baseOptions = {
  getItems: (page: Page) => page.items,
  getNextPageParam: (lastPage: Page, allPages: Page[]) => {
    const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
    return loaded < lastPage.total ? loaded : undefined;
  },
  params: undefined,
};

describe("useInfiniteQuery 分页查询 hook", () => {
  it("初始状态应该为 isFetching=true 且 pages 为空", () => {
    const { promise } = deferred<Page>();
    const { result } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn: () => promise,
      }),
    );

    expect(result.current.isFetching).toBe(true);
    expect(result.current.isFetchingNextPage).toBe(false);
    expect(result.current.pages).toEqual([]);
    expect(result.current.items).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("首页加载成功后更新 pages / items / hasNextPage", async () => {
    const { result } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn: () => Promise.resolve(makePage([1, 2], 4)),
      }),
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    expect(result.current.pages).toHaveLength(1);
    expect(result.current.items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("首页加载失败时设置 error", async () => {
    const { result } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn: () => Promise.reject(new Error("网络错误")),
      }),
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    expect(result.current.error?.message).toBe("网络错误");
    expect(result.current.pages).toEqual([]);
  });

  it("fetchNextPage 追加新页面到 pages 和 items", async () => {
    const queryFn = vi.fn();
    queryFn
      .mockResolvedValueOnce(makePage([1, 2], 4))
      .mockResolvedValueOnce(makePage([3, 4], 4));

    const { result } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn,
      }),
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });
    expect(result.current.items).toEqual([{ id: 1 }, { id: 2 }]);

    act(() => {
      result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.isFetchingNextPage).toBe(false);
    });

    expect(result.current.pages).toHaveLength(2);
    expect(result.current.items).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
    ]);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("加载更多失败时设置 error 且不丢失已有 pages", async () => {
    const queryFn = vi.fn();
    queryFn
      .mockResolvedValueOnce(makePage([1, 2], 4))
      .mockRejectedValueOnce(new Error("加载失败"));

    const { result } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn,
      }),
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    act(() => {
      result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.isFetchingNextPage).toBe(false);
    });

    expect(result.current.error?.message).toBe("加载失败");
    expect(result.current.pages).toHaveLength(1);
    expect(result.current.items).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("getNextPageParam 返回 undefined 时 hasNextPage 为 false", async () => {
    const { result } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn: () => Promise.resolve(makePage([1], 1)),
      }),
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    expect(result.current.hasNextPage).toBe(false);
  });

  it("fetchNextPage 在 hasNextPage=false 时不发起请求", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce(makePage([1], 1));

    const { result } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn,
      }),
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    act(() => {
      result.current.fetchNextPage();
    });

    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("fetchNextPage 在 getNextPageParam 返回 undefined 时不发起请求", async () => {
    const getNextPageParam = vi.fn().mockReturnValue(undefined);

    const queryFn = vi.fn().mockResolvedValueOnce(makePage([1, 2], 4));

    const { result } = renderHook(() =>
      useInfiniteQuery({
        queryKey: ["k"],
        queryFn,
        getItems: (page: Page) => page.items,
        getNextPageParam,
        params: undefined,
      }),
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    expect(result.current.hasNextPage).toBe(false);

    act(() => {
      result.current.fetchNextPage();
    });

    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("fetchNextPage 在 isFetchingNextPage=true 时不重复发起", async () => {
    const { promise, resolve } = deferred<Page>();
    const queryFn = vi.fn();
    queryFn
      .mockResolvedValueOnce(makePage([1, 2], 4))
      .mockReturnValueOnce(promise);

    const { result } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn,
      }),
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    act(() => {
      result.current.fetchNextPage();
    });
    expect(result.current.isFetchingNextPage).toBe(true);

    act(() => {
      result.current.fetchNextPage();
    });

    expect(queryFn).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolve(makePage([3, 4], 4));
    });
  });

  it("queryKey 变化时重置 pages 并重新获取首页", async () => {
    const queryFn = vi.fn();
    queryFn
      .mockResolvedValueOnce(makePage([1], 3))
      .mockResolvedValueOnce(makePage([10], 20));

    const { result, rerender } = renderHook(
      ({ keyword }: { keyword: string }) =>
        useInfiniteQuery({
          ...baseOptions,
          queryKey: [keyword],
          queryFn,
          params: { keyword },
        }),
      { initialProps: { keyword: "a" } },
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });
    expect(result.current.items).toEqual([{ id: 1 }]);

    rerender({ keyword: "b" });

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });
    expect(result.current.items).toEqual([{ id: 10 }]);
    expect(result.current.pages).toHaveLength(1);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("queryKey 快速变化时旧请求结果应被忽略", async () => {
    const first = deferred<Page>();
    const second = deferred<Page>();

    const { result, rerender } = renderHook(
      ({ keyword }: { keyword: string }) =>
        useInfiniteQuery({
          ...baseOptions,
          queryKey: [keyword],
          queryFn: () => (keyword === "a" ? first.promise : second.promise),
          params: { keyword },
        }),
      { initialProps: { keyword: "a" } },
    );

    rerender({ keyword: "b" });

    act(() => {
      first.resolve(makePage([1], 1));
    });

    await waitFor(() => {
      expect(result.current.isFetching).toBe(true);
    });
    expect(result.current.pages).toEqual([]);

    act(() => {
      second.resolve(makePage([2], 1));
    });

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });
    expect(result.current.items).toEqual([{ id: 2 }]);
  });

  it("refetch 应从首页重新获取", async () => {
    const queryFn = vi.fn();
    queryFn
      .mockResolvedValueOnce(makePage([1, 2], 4))
      .mockResolvedValueOnce(makePage([3, 4], 4))
      .mockResolvedValueOnce(makePage([10, 20], 30));

    const { result } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn,
      }),
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    act(() => {
      result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.pages).toHaveLength(2);
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });
    expect(result.current.pages).toHaveLength(1);
    expect(result.current.items).toEqual([{ id: 10 }, { id: 20 }]);
  });

  it("enabled=false 时不发起请求", () => {
    const queryFn = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn,
        enabled: false,
      }),
    );

    expect(queryFn).not.toHaveBeenCalled();
    expect(result.current.isFetching).toBe(false);
    expect(result.current.pages).toEqual([]);
  });

  it("组件卸载时应取消未完成的请求", async () => {
    const { promise } = deferred<Page>();
    const queryFn = vi.fn(() => promise);

    const { unmount } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn,
      }),
    );

    unmount();
  });

  it("fetchNextPage 应传入正确的 pageParam", async () => {
    const queryFn = vi.fn();
    queryFn
      .mockResolvedValueOnce(makePage([1, 2], 6))
      .mockResolvedValueOnce(makePage([3, 4], 6))
      .mockResolvedValueOnce(makePage([5, 6], 6));

    const { result } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn,
      }),
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    act(() => {
      result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.isFetchingNextPage).toBe(false);
    });

    act(() => {
      result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(6);
    });

    expect(queryFn.mock.calls[1][2]).toBe(2);
    expect(queryFn.mock.calls[2][2]).toBe(4);
  });

  it("非 Error 类型异常应被包装为 Error", async () => {
    const { result } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn: () => Promise.reject("字符串错误"),
      }),
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("字符串错误");
  });

  it("params 变化但 queryKey 不变时不应重新获取首页", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce(makePage([1], 1));

    const { result, rerender } = renderHook(
      ({ keyword }: { keyword: string }) =>
        useInfiniteQuery({
          ...baseOptions,
          queryKey: ["stable"],
          queryFn,
          params: { keyword },
        }),
      { initialProps: { keyword: "a" } },
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    rerender({ keyword: "b" });

    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("设置 timeout 后首页加载成功应正常返回", async () => {
    const { result } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn: () => Promise.resolve(makePage([1], 1)),
        timeout: new Duration({ seconds: 5 }),
      }),
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    expect(result.current.items).toEqual([{ id: 1 }]);
    expect(result.current.error).toBeNull();
  });

  it("设置 timeout 后首页加载超时应设置 error", async () => {
    const { promise } = deferred<Page>();
    const { result } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn: (ctx) =>
          Promise.race([
            promise,
            ctx.done().then(() => {
              throw ctx.err()!;
            }),
          ]),
        timeout: new Duration({ milliseconds: 50 }),
      }),
    );

    expect(result.current.isFetching).toBe(true);

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.pages).toEqual([]);
  });

  it("设置 timeout 后加载更多超时应设置 error", async () => {
    const { promise } = deferred<Page>();
    const queryFn = vi.fn();
    queryFn.mockResolvedValueOnce(makePage([1, 2], 4));
    queryFn.mockImplementationOnce((_ctx: unknown) =>
      Promise.race([
        promise,
        (_ctx as { done: () => Promise<void> }).done().then(() => {
          throw (_ctx as { err: () => Error }).err()!;
        }),
      ]),
    );

    const { result } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn,
        timeout: new Duration({ milliseconds: 50 }),
      }),
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    act(() => {
      result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.isFetchingNextPage).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.pages).toHaveLength(1);
  });

  it("首页获取被取消时不应设置 error", async () => {
    const firstDeferred = deferred<Page>();
    const { result, unmount } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn: () => firstDeferred.promise,
      }),
    );

    expect(result.current.isFetching).toBe(true);

    unmount();

    await act(async () => {
      firstDeferred.reject(new Error("已取消"));
    });
  });

  it("加载更多被取消时不应设置 error", async () => {
    const loadMoreDeferred = deferred<Page>();
    const queryFn = vi.fn();
    queryFn
      .mockResolvedValueOnce(makePage([1, 2], 4))
      .mockReturnValueOnce(loadMoreDeferred.promise)
      .mockResolvedValueOnce(makePage([10], 30));

    const { result, rerender } = renderHook(
      ({ keyword }: { keyword: string }) =>
        useInfiniteQuery({
          ...baseOptions,
          queryKey: [keyword],
          queryFn,
          params: { keyword },
        }),
      { initialProps: { keyword: "a" } },
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    act(() => {
      result.current.fetchNextPage();
    });
    expect(result.current.isFetchingNextPage).toBe(true);

    rerender({ keyword: "b" });

    await act(async () => {
      loadMoreDeferred.reject(new Error("已取消"));
    });

    expect(result.current.error).toBeNull();
  });

  it("enabled 从 false 变为 true 时应自动获取首页", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce(makePage([1], 1));

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useInfiniteQuery({
          ...baseOptions,
          queryKey: ["k"],
          queryFn,
          enabled,
        }),
      { initialProps: { enabled: false } },
    );

    expect(queryFn).not.toHaveBeenCalled();
    expect(result.current.isFetching).toBe(false);

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(result.current.items).toEqual([{ id: 1 }]);
  });

  it("加载更多非 Error 类型异常应被包装为 Error", async () => {
    const queryFn = vi.fn();
    queryFn
      .mockResolvedValueOnce(makePage([1, 2], 4))
      .mockRejectedValueOnce("字符串错误");

    const { result } = renderHook(() =>
      useInfiniteQuery({
        ...baseOptions,
        queryKey: ["k"],
        queryFn,
      }),
    );

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    act(() => {
      result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.isFetchingNextPage).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("字符串错误");
  });
});

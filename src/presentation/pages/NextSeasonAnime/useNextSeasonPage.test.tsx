import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import type { UseNextSeasonPageDeps } from "./useNextSeasonPage";
import { useNextSeasonPage } from "./useNextSeasonPage";

const mockItems: AnimeSubject[] = [
  {
    id: 1,
    name: "测试动漫",
    image: "http://example.com/1.jpg",
    rating: 8,
    summary: "",
  },
];

const makeDeps = (
  overrides: Partial<UseNextSeasonPageDeps> = {},
): UseNextSeasonPageDeps => ({
  getNextSeasonUseCase: {
    execute: vi.fn().mockResolvedValue({
      items: mockItems,
      hasNextPage: true,
    }),
  },
  ...overrides,
});

const lastNavigation: {
  current: { pathname: string; search: string; state: unknown } | null;
} = { current: null };
const LocationTracker = () => {
  const location = useLocation();
  lastNavigation.current = {
    pathname: location.pathname,
    search: location.search,
    state: location.state,
  };
  return null;
};

const RouterWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <LocationTracker />
      {children}
    </MemoryRouter>
  );
};

const renderUseNextSeasonPage = (
  deps: UseNextSeasonPageDeps,
  monthParam?: number,
) => {
  return renderHook(
    () => useNextSeasonPage(deps, (id) => `/bangumi/subject/${id}`, monthParam),
    {
      wrapper: RouterWrapper,
    },
  );
};

describe("useNextSeasonPage 下季新番页面 hook", () => {
  it("应该调用 getNextSeasonUseCase.execute 并返回当前月份数据", async () => {
    const deps = makeDeps();
    const { result } = renderUseNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual(mockItems);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("请求失败时应该返回错误信息并支持 refetch", async () => {
    const executeMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("API error"))
      .mockResolvedValueOnce({ items: mockItems, hasNextPage: true });

    const deps = makeDeps({
      getNextSeasonUseCase: { execute: executeMock },
    });

    const { result } = renderUseNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.error).toBe("API error");
    });

    expect(result.current.isLoading).toBe(false);

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.items).toEqual(mockItems);
    });
    expect(result.current.error).toBeNull();
  });

  it("切换 Tab 时应该懒加载对应月份数据", async () => {
    const executeMock = vi.fn().mockImplementation((_ctx, params) => {
      return Promise.resolve({
        items: [
          {
            id: params.month * 10,
            name: `${params.month}月新番`,
            image: "",
            rating: 8,
            summary: "",
          },
        ],
        hasNextPage: true,
      });
    });

    const deps = makeDeps({
      getNextSeasonUseCase: { execute: executeMock },
    });

    const { result } = renderUseNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const secondMonth = result.current.tabs[1].month;
    expect(executeMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setActiveMonth(secondMonth);
    });

    await waitFor(() => {
      expect(result.current.activeMonth).toBe(secondMonth);
      expect(result.current.items[0]?.name).toBe(`${secondMonth}月新番`);
    });

    expect(executeMock).toHaveBeenCalledTimes(2);

    // 切换回第一个月会重新发起请求（月份作为 queryKey 的一部分）
    const firstMonth = result.current.tabs[0].month;
    act(() => {
      result.current.setActiveMonth(firstMonth);
    });

    await waitFor(() => {
      expect(result.current.activeMonth).toBe(firstMonth);
      expect(result.current.items[0]?.name).toBe(`${firstMonth}月新番`);
    });

    expect(executeMock).toHaveBeenCalledTimes(3);
  });

  it("loadMore 应该加载下一页并追加条目", async () => {
    const executeMock = vi
      .fn()
      .mockResolvedValueOnce({ items: mockItems, hasNextPage: true })
      .mockResolvedValueOnce({
        items: [
          { id: 2, name: "第二页动漫", image: "", rating: 9, summary: "" },
        ],
        hasNextPage: false,
      });

    const deps = makeDeps({
      getNextSeasonUseCase: { execute: executeMock },
    });

    const { result } = renderUseNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    expect(result.current.hasMore).toBe(false);
  });

  it("handleAnimeClick 应该导航到 subject 页面并传递名称与封面", async () => {
    const deps = makeDeps();
    const { result } = renderUseNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleAnimeClick({
        id: 123,
        name: "测试动漫",
        image: "http://example.com/cover.jpg",
        rating: 8,
        summary: "",
      });
    });

    expect(lastNavigation.current?.pathname).toBeTruthy();
    expect(lastNavigation.current?.state).toEqual({
      name: "测试动漫",
      imageUrl: "http://example.com/cover.jpg",
    });
  });

  it("月份 A 加载更多进行中切换到月份 B，月份 B 的 loadMore 不应被阻塞", async () => {
    let resolveMonthALoadMore: (v: {
      items: AnimeSubject[];
      hasNextPage: boolean;
    }) => void;

    const executeMock = vi.fn().mockImplementation((_ctx, params) => {
      if (params.offset === 0) {
        return Promise.resolve({ items: mockItems, hasNextPage: true });
      }
      return new Promise((resolve) => {
        resolveMonthALoadMore = resolve;
      });
    });

    const deps = makeDeps({
      getNextSeasonUseCase: { execute: executeMock },
    });

    const { result } = renderUseNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual(mockItems);

    act(() => {
      result.current.loadMore();
    });

    expect(executeMock).toHaveBeenCalledTimes(2);

    const secondMonth = result.current.tabs[1].month;
    act(() => {
      result.current.setActiveMonth(secondMonth);
    });

    // 切换月份会重置分页，等待月份 B 的首页加载完成
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.activeMonth).toBe(secondMonth);
      expect(result.current.items).toHaveLength(1);
    });

    act(() => {
      result.current.loadMore();
    });

    // 月份 B 的首页已加载（offset=0），loadMore 时 offset=1
    expect(executeMock).toHaveBeenCalledTimes(4);
    expect(executeMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ month: secondMonth, offset: 1 }),
    );

    await act(async () => {
      resolveMonthALoadMore!({ items: [], hasNextPage: false });
    });
  });

  it("exhausted 的月份不应再触发 loadMore", async () => {
    let resolveLoadMore: (v: {
      items: AnimeSubject[];
      hasNextPage: boolean;
    }) => void;

    const executeMock = vi.fn().mockImplementation((_ctx, params) => {
      if (params.offset === 0) {
        return Promise.resolve({ items: mockItems, hasNextPage: true });
      }
      return new Promise((resolve) => {
        resolveLoadMore = resolve;
      });
    });

    const deps = makeDeps({
      getNextSeasonUseCase: { execute: executeMock },
    });

    const { result } = renderUseNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });

    await act(async () => {
      resolveLoadMore!({ items: [], hasNextPage: false });
    });

    await waitFor(() => {
      expect(result.current.hasMore).toBe(false);
    });

    const callCount = executeMock.mock.calls.length;
    act(() => {
      result.current.loadMore();
    });

    expect(executeMock.mock.calls.length).toBe(callCount);
  });

  it("loadMore 追加重复 id 条目时应该去重", async () => {
    const itemA = mockItems[0];
    const itemB: AnimeSubject = {
      id: 2,
      name: "第二条目",
      image: "",
      rating: 9,
      summary: "",
    };
    // AniList 分页可能重复返回同一条目
    const executeMock = vi
      .fn()
      .mockResolvedValueOnce({ items: [itemA], hasNextPage: true })
      .mockResolvedValueOnce({ items: [itemA, itemB], hasNextPage: true });

    const deps = makeDeps({
      getNextSeasonUseCase: { execute: executeMock },
    });

    const { result } = renderUseNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.items).toEqual([itemA]);
    });

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.items).toEqual([itemA, itemB]);
    });
    expect(result.current.hasMore).toBe(true);
  });

  it("loadMore 传入空数组时应该将月份标记为 exhausted", async () => {
    const executeMock = vi
      .fn()
      .mockResolvedValueOnce({ items: mockItems, hasNextPage: true })
      .mockResolvedValueOnce({ items: [], hasNextPage: false });

    const deps = makeDeps({
      getNextSeasonUseCase: { execute: executeMock },
    });

    const { result } = renderUseNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.hasMore).toBe(false);
    });
  });

  it("切换选中月份时应该写入 URL 查询参数", async () => {
    const deps = makeDeps();
    const { result } = renderUseNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const secondMonth = result.current.tabs[1].month;
    act(() => {
      result.current.setActiveMonth(secondMonth);
    });

    await waitFor(() => {
      expect(result.current.activeMonth).toBe(secondMonth);
    });
    expect(lastNavigation.current?.search).toContain(`month=${secondMonth}`);

    // 重复选择同一月份时不应重复写入 URL
    act(() => {
      result.current.setActiveMonth(secondMonth);
    });
    expect(result.current.activeMonth).toBe(secondMonth);
    expect(lastNavigation.current?.search).toContain(`month=${secondMonth}`);
  });

  it("monthParam 在当季月份列表内时应该作为初始选中月份", async () => {
    const deps = makeDeps();
    const { result } = renderUseNextSeasonPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const secondMonth = result.current.tabs[1].month;
    const { result: result2, unmount } = renderHook(
      () =>
        useNextSeasonPage(deps, (id) => `/bangumi/subject/${id}`, secondMonth),
      { wrapper: RouterWrapper },
    );

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false);
    });
    expect(result2.current.activeMonth).toBe(secondMonth);
    unmount();
  });
});

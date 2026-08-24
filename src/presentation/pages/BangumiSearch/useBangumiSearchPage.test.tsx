import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode, SubmitEvent } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { vi } from "vitest";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { resetAppStores } from "@/test/store-reset";
import type { UseBangumiSearchPageDeps } from "./useBangumiSearchPage";
import { useBangumiSearchPage } from "./useBangumiSearchPage";

const locationRef: { current: { pathname: string; search: string } | null } = {
  current: null,
};
function LocationCapture() {
  locationRef.current = useLocation();
  return null;
}
function RouterWrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <LocationCapture />
      {children}
    </MemoryRouter>
  );
}

function makeSubject(overrides: Partial<AnimeSubject> = {}): AnimeSubject {
  return {
    id: 1,
    name: "间谍过家家",
    summary: "简介",
    image: "https://img.example/l.jpg",
    rating: 8.5,
    date: "2022-04-09",
    eps: 12,
    platform: "TV",
    ...overrides,
  };
}

const makeDeps = (
  overrides: Partial<UseBangumiSearchPageDeps> = {},
): UseBangumiSearchPageDeps => ({
  searchBangumiSubjectsUseCase: {
    execute: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
  ...overrides,
});

const renderPage = async (
  options: { deps?: UseBangumiSearchPageDeps; keyword?: string } = {},
) => {
  const deps = options.deps ?? makeDeps();
  const hook = renderHook(() => useBangumiSearchPage(options.keyword, deps), {
    wrapper: RouterWrapper,
  });
  await act(async () => {});
  return { result: hook.result, deps, unmount: hook.unmount };
};

const searchParams = (keyword: string) => ({
  keyword,
  limit: 20,
  offset: 0,
});

describe("useBangumiSearchPage 动漫搜索 hook", () => {
  beforeEach(() => {
    resetAppStores();
    vi.clearAllMocks();
    locationRef.current = null;
  });

  it("performSearch 调用 useCase.execute 并写入搜索结果", async () => {
    const subject = makeSubject();
    const deps = makeDeps();
    vi.mocked(deps.searchBangumiSubjectsUseCase.execute).mockResolvedValue({
      items: [subject],
      total: 1,
    });

    const { result } = await renderPage({ deps });
    act(() => result.current.search.setKeyword("间谍过家家"));
    act(() => result.current.search.performSearch("间谍过家家"));

    await waitFor(() => {
      expect(result.current.status.loading).toBe(false);
    });

    expect(deps.searchBangumiSubjectsUseCase.execute).toHaveBeenCalledWith(
      expect.anything(),
      searchParams("间谍过家家"),
    );
    expect(result.current.results.items).toEqual([subject]);
    expect(result.current.status.hasSearched).toBe(true);
  });

  it("handleSearch 使用输入框关键词并去除首尾空白", async () => {
    const deps = makeDeps();
    const { result } = await renderPage({ deps });

    act(() => result.current.search.setKeyword("  间谍过家家  "));
    act(() =>
      result.current.search.handleSearch({
        preventDefault: vi.fn(),
      } as unknown as SubmitEvent),
    );

    await waitFor(() => {
      expect(result.current.status.loading).toBe(false);
    });
    expect(deps.searchBangumiSubjectsUseCase.execute).toHaveBeenCalledWith(
      expect.anything(),
      searchParams("间谍过家家"),
    );
  });

  it("URL 携带关键词时自动搜索并清理 searchParams", async () => {
    const deps = makeDeps();
    const { result } = await renderPage({ deps, keyword: "柯南" });

    await waitFor(() => {
      expect(result.current.status.loading).toBe(false);
    });

    expect(deps.searchBangumiSubjectsUseCase.execute).toHaveBeenCalledWith(
      expect.anything(),
      searchParams("柯南"),
    );
    expect(result.current.search.keyword).toBe("柯南");
    expect(locationRef.current?.search).toBe("");
  });

  it("搜索失败时清空结果并记录错误", async () => {
    const deps = makeDeps();
    vi.mocked(deps.searchBangumiSubjectsUseCase.execute).mockRejectedValue(
      new Error("网络错误"),
    );

    const { result } = await renderPage({ deps });
    act(() => result.current.search.performSearch("xxx"));

    await waitFor(() => {
      expect(result.current.status.loading).toBe(false);
    });

    expect(result.current.results.items).toEqual([]);
    expect(result.current.status.error).toEqual(new Error("网络错误"));
    expect(result.current.status.hasSearched).toBe(true);
  });

  it("handleSubjectClick 跳转到对应条目详情页", async () => {
    const subject = makeSubject();
    const deps = makeDeps();
    const { result } = await renderPage({ deps });

    act(() => result.current.results.handleSubjectClick(subject));

    expect(locationRef.current?.pathname).toBe("/subject/1");
  });

  it("从详情页返回（重新挂载）后应保留搜索结果", async () => {
    const subject = makeSubject();
    const deps = makeDeps();
    vi.mocked(deps.searchBangumiSubjectsUseCase.execute).mockResolvedValue({
      items: [subject],
      total: 1,
    });

    const first = await renderPage({ deps });
    act(() => first.result.current.search.setKeyword("间谍过家家"));
    act(() => first.result.current.search.performSearch("间谍过家家"));
    await waitFor(() => {
      expect(first.result.current.status.loading).toBe(false);
    });
    first.unmount();

    const second = await renderPage({ deps });
    expect(second.result.current.results.items).toEqual([subject]);
    expect(second.result.current.search.keyword).toBe("间谍过家家");
    expect(second.result.current.status.hasSearched).toBe(true);
    second.unmount();
  });

  it("onLoadMore 追加下一页结果并携带正确的 offset", async () => {
    const subject1 = makeSubject({ id: 1 });
    const subject2 = makeSubject({ id: 2 });
    const deps = makeDeps();
    vi.mocked(deps.searchBangumiSubjectsUseCase.execute)
      .mockResolvedValueOnce({ items: [subject1], total: 40 })
      .mockResolvedValueOnce({ items: [subject2], total: 40 });

    const { result } = await renderPage({ deps });
    act(() => result.current.search.setKeyword("柯南"));
    act(() => result.current.search.performSearch("柯南"));
    await waitFor(() => {
      expect(result.current.status.loading).toBe(false);
    });

    expect(result.current.status.hasMore).toBe(true);
    expect(result.current.status.loadingMore).toBe(false);

    act(() => result.current.results.onLoadMore());
    await waitFor(() => {
      expect(result.current.status.loadingMore).toBe(false);
    });

    expect(deps.searchBangumiSubjectsUseCase.execute).toHaveBeenLastCalledWith(
      expect.anything(),
      { keyword: "柯南", limit: 20, offset: 1 },
    );
    expect(result.current.results.items).toEqual([subject1, subject2]);
  });

  it("已加载全部结果时 hasMore 为 false 且 onLoadMore 不再请求", async () => {
    const subject = makeSubject();
    const deps = makeDeps();
    vi.mocked(deps.searchBangumiSubjectsUseCase.execute).mockResolvedValue({
      items: [subject],
      total: 1,
    });

    const { result } = await renderPage({ deps });
    act(() => result.current.search.performSearch("柯南"));
    await waitFor(() => {
      expect(result.current.status.loading).toBe(false);
    });

    expect(result.current.status.hasMore).toBe(false);

    act(() => result.current.results.onLoadMore());
    await waitFor(() => {
      expect(result.current.status.loadingMore).toBe(false);
    });
    expect(deps.searchBangumiSubjectsUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it("新搜索会取消进行中的加载更多", async () => {
    const subject = makeSubject();
    const deps = makeDeps();
    let resolveLoadMore: (value: unknown) => void;
    const pendingLoadMore = new Promise((resolve) => {
      resolveLoadMore = resolve;
    });
    vi.mocked(deps.searchBangumiSubjectsUseCase.execute)
      .mockResolvedValueOnce({ items: [subject], total: 40 })
      .mockImplementationOnce(() => pendingLoadMore as Promise<never>)
      .mockResolvedValueOnce({ items: [makeSubject({ id: 3 })], total: 40 });

    const { result } = await renderPage({ deps });
    act(() => result.current.search.setKeyword("柯南"));
    act(() => result.current.search.performSearch("柯南"));
    await waitFor(() => {
      expect(result.current.status.loading).toBe(false);
    });

    act(() => result.current.results.onLoadMore());
    expect(result.current.status.loadingMore).toBe(true);

    act(() => result.current.search.performSearch("间谍过家家"));
    resolveLoadMore!({ items: [makeSubject({ id: 99 })], total: 40 });

    await waitFor(() => {
      expect(result.current.status.loading).toBe(false);
    });
    expect(result.current.results.items).toEqual([makeSubject({ id: 3 })]);
    expect(result.current.results.items).not.toContainEqual(
      makeSubject({ id: 99 }),
    );
  });

  it("加载更多进行中离开页面后返回，不应卡在加载中且能继续加载", async () => {
    const subject = makeSubject();
    const deps = makeDeps();
    vi.mocked(deps.searchBangumiSubjectsUseCase.execute).mockResolvedValue({
      items: [subject],
      total: 40,
    });

    const first = await renderPage({ deps });
    act(() => first.result.current.search.setKeyword("柯南"));
    act(() => first.result.current.search.performSearch("柯南"));
    await waitFor(() => {
      expect(first.result.current.status.loading).toBe(false);
    });

    let resolveLoadMore: (value: unknown) => void;
    const pendingLoadMore = new Promise((resolve) => {
      resolveLoadMore = resolve;
    });
    vi.mocked(deps.searchBangumiSubjectsUseCase.execute).mockImplementationOnce(
      () => pendingLoadMore as Promise<never>,
    );

    act(() => first.result.current.results.onLoadMore());
    expect(first.result.current.status.loadingMore).toBe(true);
    first.unmount();
    resolveLoadMore!({ items: [makeSubject({ id: 99 })], total: 40 });

    const second = await renderPage({ deps });
    expect(second.result.current.status.loadingMore).toBe(false);

    act(() => second.result.current.results.onLoadMore());
    await waitFor(() => {
      expect(second.result.current.status.loadingMore).toBe(false);
    });
    expect(deps.searchBangumiSubjectsUseCase.execute).toHaveBeenLastCalledWith(
      expect.anything(),
      { keyword: "柯南", limit: 20, offset: 1 },
    );
    second.unmount();
  });
});

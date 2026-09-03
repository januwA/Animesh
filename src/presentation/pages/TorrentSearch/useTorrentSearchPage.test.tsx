import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import {
  TORRENT_SEARCH_ENGINES,
  type TorrentSearchEngine,
} from "@/domain/torrent/TorrentEngines";
import type { SearchResultItem } from "@/domain/torrent/TorrentSchemas";
import { useSearchHistoryStore } from "@/presentation/store/searchHistoryStore";
import { resetAppStores } from "@/test/store-reset";
import type { UseTorrentSearchPageDeps } from "./useTorrentSearchPage";
import { useTorrentSearchPage } from "./useTorrentSearchPage";

// Mock clipboard API
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn(),
  },
  writable: true,
});

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

function makeSearchResults(
  ...items: Array<Partial<SearchResultItem> & Pick<SearchResultItem, "title">>
): SearchResultItem[] {
  return items.map((item, idx) => ({
    link: NonEmptyStringSchema.parse(
      `http://example.com/${String(item.title ?? idx)}`,
    ),
    pub_date: "2026-06-23",
    magnet: NonEmptyStringSchema.parse("magnet:?xt=urn:btih:TEST1"),
    description: "",
    ...item,
  }));
}

const makeDeps = (
  overrides: Partial<UseTorrentSearchPageDeps> = {},
): UseTorrentSearchPageDeps => ({
  searchTorrentsUseCase: {
    execute: vi.fn().mockResolvedValue([]),
  },
  ...overrides,
});

const renderPage = async (
  options: { deps?: UseTorrentSearchPageDeps; keyword?: string } = {},
) => {
  const deps = options.deps ?? makeDeps();
  const hook = renderHook(() => useTorrentSearchPage(options.keyword, deps), {
    wrapper: RouterWrapper,
  });
  await act(async () => {});
  return { result: hook.result, deps, unmount: hook.unmount };
};

const searchDto = (keyword: string, engine: TorrentSearchEngine) => ({
  keyword,
  engine,
});

describe("useTorrentSearchPage 搜索页面 hook", () => {
  beforeEach(() => {
    localStorage.clear();
    resetAppStores();
    vi.clearAllMocks();
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
    locationRef.current = null;
  });

  it("搜索调用 searchTorrentsUseCase 并携带默认引擎", async () => {
    const { result, deps } = await renderPage();

    act(() =>
      result.current.search.performSearch("xxx", [TORRENT_SEARCH_ENGINES[0]]),
    );

    await waitFor(() => {
      expect(
        vi.mocked(deps.searchTorrentsUseCase.execute),
      ).toHaveBeenCalledWith(
        expect.any(Object),
        searchDto("xxx", TORRENT_SEARCH_ENGINES[0]),
      );
    });
  });

  it("多引擎搜索时并发调用 searchTorrentsUseCase", async () => {
    const { result, deps } = await renderPage();
    const engines: TorrentSearchEngine[] = ["dmhy", "nyaa"];

    act(() => result.current.search.performSearch("xxx", engines));

    await waitFor(() => {
      expect(deps.searchTorrentsUseCase.execute).toHaveBeenCalledTimes(2);
    });
    expect(deps.searchTorrentsUseCase.execute).toHaveBeenCalledWith(
      expect.any(Object),
      searchDto("xxx", "dmhy"),
    );
    expect(deps.searchTorrentsUseCase.execute).toHaveBeenCalledWith(
      expect.any(Object),
      searchDto("xxx", "nyaa"),
    );
  });

  it("handleSearch 应使用输入框关键词（去除首尾空白）执行搜索", async () => {
    const { result, deps } = await renderPage();

    act(() => result.current.search.setSearchKeyword("  xxx  "));
    act((() =>
      result.current.search.handleSearch({
        preventDefault: vi.fn(),
      } as unknown as React.SubmitEvent)) as () => void);

    await waitFor(() => {
      expect(
        vi.mocked(deps.searchTorrentsUseCase.execute),
      ).toHaveBeenCalledWith(
        expect.any(Object),
        searchDto("xxx", TORRENT_SEARCH_ENGINES[0]),
      );
    });
  });

  it("搜索成功时更新结果与历史记录，失败时清空结果", async () => {
    const { result, deps } = await renderPage();
    vi.mocked(deps.searchTorrentsUseCase.execute).mockResolvedValueOnce(
      makeSearchResults({ title: NonEmptyStringSchema.parse("xxx 第1集") }),
    );

    act(() =>
      result.current.search.performSearch("xxx", [TORRENT_SEARCH_ENGINES[0]]),
    );

    await waitFor(() => {
      expect(result.current.results.searchResults).toHaveLength(1);
    });
    expect(result.current.searchHistory.history).toEqual(["xxx"]);

    vi.mocked(deps.searchTorrentsUseCase.execute).mockRejectedValueOnce(
      new Error("boom"),
    );
    act(() =>
      result.current.search.performSearch("yyy", [TORRENT_SEARCH_ENGINES[0]]),
    );

    await waitFor(() => {
      expect(result.current.status.error).not.toBeNull();
    });
    expect(result.current.results.searchResults).toEqual([]);
  });

  it("搜索失败后重试应恢复结果并清空错误", async () => {
    const { result, deps } = await renderPage();
    vi.mocked(deps.searchTorrentsUseCase.execute)
      .mockRejectedValueOnce("网络请求超时")
      .mockResolvedValueOnce(
        makeSearchResults({ title: NonEmptyStringSchema.parse("xxx 第1集") }),
      );

    act(() =>
      result.current.search.performSearch("xxx", [TORRENT_SEARCH_ENGINES[0]]),
    );
    await waitFor(() => expect(result.current.status.error).not.toBeNull());

    act(() =>
      result.current.search.performSearch("xxx", [TORRENT_SEARCH_ENGINES[0]]),
    );
    await waitFor(() => expect(result.current.status.error).toBeNull());
    expect(result.current.results.searchResults).toHaveLength(1);
  });

  it("搜索返回空结果时 searchResults 应为空数组且标记已搜索", async () => {
    const { result } = await renderPage();

    act(() =>
      result.current.search.performSearch("xxx", [TORRENT_SEARCH_ENGINES[0]]),
    );

    await waitFor(() => {
      expect(result.current.results.searchResults).toEqual([]);
    });
  });

  it("挂载时传入 URL keyword 应触发搜索并清空 URL 参数", async () => {
    const { result, deps } = await renderPage({ keyword: "xxx" });

    await waitFor(() => {
      expect(
        vi.mocked(deps.searchTorrentsUseCase.execute),
      ).toHaveBeenCalledWith(
        expect.any(Object),
        searchDto("xxx", TORRENT_SEARCH_ENGINES[0]),
      );
    });
    expect(result.current.search.searchKeyword).toBe("xxx");
    expect(locationRef.current?.search).toBe("");
  });

  it("搜索时应将关键词加入历史记录（去重、置顶、不限数量）", async () => {
    const { result } = await renderPage();

    act(() =>
      result.current.search.performSearch("xxx", [TORRENT_SEARCH_ENGINES[0]]),
    );
    act(() =>
      result.current.search.performSearch("柯南", [TORRENT_SEARCH_ENGINES[0]]),
    );
    act(() =>
      result.current.search.performSearch("xxx", [TORRENT_SEARCH_ENGINES[0]]),
    );

    expect(result.current.searchHistory.history).toEqual(["xxx", "柯南"]);

    for (let i = 1; i <= 10; i++) {
      act(() =>
        result.current.search.performSearch(`动漫_${i}`, [
          TORRENT_SEARCH_ENGINES[0],
        ]),
      );
    }
    await act(async () => {});
    expect(result.current.searchHistory.history).toHaveLength(12);
    expect(result.current.searchHistory.history[0]).toBe("动漫_10");
  });

  it("应该从 store 初始化历史记录", async () => {
    useSearchHistoryStore.setState({ history: ["xxx", "柯南"] });
    const { result } = await renderPage();
    expect(result.current.searchHistory.history).toEqual(["xxx", "柯南"]);
  });

  it("非法 JSON 降级为空数组", async () => {
    localStorage.setItem("animesh_search_history", "invalid-json{");
    const { result } = await renderPage();
    expect(result.current.searchHistory.history).toEqual([]);
  });

  it("删除单个历史记录项时更新列表", async () => {
    useSearchHistoryStore.setState({ history: ["xxx", "柯南"] });
    const { result } = await renderPage();

    act(() => result.current.searchHistory.handleDeleteHistory("xxx"));

    expect(result.current.searchHistory.history).toEqual(["柯南"]);
  });

  it("删除最后一项历史记录时清空列表", async () => {
    useSearchHistoryStore.setState({ history: ["xxx"] });
    const { result } = await renderPage();

    act(() => result.current.searchHistory.handleDeleteHistory("xxx"));

    expect(result.current.searchHistory.history).toEqual([]);
  });

  it("清空历史记录时清空列表", async () => {
    useSearchHistoryStore.setState({ history: ["xxx", "柯南"] });
    const { result } = await renderPage();

    act(() => result.current.searchHistory.handleClearHistory());

    expect(result.current.searchHistory.history).toEqual([]);
  });

  it("复制磁力成功时提示成功", async () => {
    const { result } = await renderPage();

    await act(async () => {
      await result.current.results.handleCopyMagnet(
        "magnet:?xt=urn:btih:TEST1",
      );
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "magnet:?xt=urn:btih:TEST1",
    );
    expect(toast.success).toHaveBeenCalledWith("磁力链接已复制到剪贴板");
  });

  it("复制磁力失败时提示失败", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
      new Error("Permission denied"),
    );
    const { result } = await renderPage();

    await act(async () => {
      await result.current.results.handleCopyMagnet(
        "magnet:?xt=urn:btih:TEST1",
      );
    });

    expect(toast.error).toHaveBeenCalledWith("复制失败，请手动复制");
  });

  it("点击边下边播时跳转到 torrent 详情页并携带参数", async () => {
    const { result } = await renderPage();

    act(() => result.current.results.handlePlay("magnet:?xt=urn:btih:TEST1"));

    expect(locationRef.current?.pathname).toBe("/torrent");
    expect(locationRef.current?.search).toContain("magnet=");
    expect(locationRef.current?.search).toBeTruthy();
  });

  it("取消搜索时发起取消请求并清空加载状态", async () => {
    let isCancelled = false;
    const searchPromise = new Promise<never>(() => {});
    const { result } = await renderPage({
      deps: makeDeps({
        searchTorrentsUseCase: {
          execute: vi.fn().mockImplementation((ctx) => {
            ctx.done().then(() => {
              isCancelled = true;
            });
            return searchPromise;
          }),
        },
      }),
    });

    act(() =>
      result.current.search.performSearch("xxx", [TORRENT_SEARCH_ENGINES[0]]),
    );
    expect(result.current.status.loading).toBe(true);

    act(() => result.current.status.handleCancel());

    await waitFor(() => expect(isCancelled).toBe(true));
    expect(result.current.status.loading).toBe(false);
  });

  it("卸载时自动取消正在进行的搜索", async () => {
    let isCancelled = false;
    const searchPromise = new Promise<never>(() => {});
    const { result, unmount } = await renderPage({
      deps: makeDeps({
        searchTorrentsUseCase: {
          execute: vi.fn().mockImplementation((ctx) => {
            ctx.done().then(() => {
              isCancelled = true;
            });
            return searchPromise;
          }),
        },
      }),
    });

    act(() =>
      result.current.search.performSearch("xxx", [TORRENT_SEARCH_ENGINES[0]]),
    );
    unmount();

    await waitFor(() => expect(isCancelled).toBe(true));
  });

  it("搜索结果按字幕组数量降序分组，未标注组恒排最后", async () => {
    const { result, deps } = await renderPage();
    vi.mocked(deps.searchTorrentsUseCase.execute).mockResolvedValue(
      makeSearchResults(
        { title: NonEmptyStringSchema.parse("[GroupB] 某番 01") },
        { title: NonEmptyStringSchema.parse("[GroupA] 某番 01") },
        { title: NonEmptyStringSchema.parse("[GroupA] 某番 02") },
        { title: NonEmptyStringSchema.parse("[GroupA] 某番 03") },
        { title: NonEmptyStringSchema.parse("某番 无前缀1") },
      ),
    );

    act(() =>
      result.current.search.performSearch("某番", [TORRENT_SEARCH_ENGINES[0]]),
    );

    await waitFor(() => {
      expect(result.current.results.groups).toHaveLength(3);
    });
    expect(result.current.results.groups[0].name).toBe("GroupA");
    expect(result.current.results.groups[0].items).toHaveLength(3);
    expect(result.current.results.groups[1].name).toBe("GroupB");
    expect(result.current.results.groups[2].name).toBe("未标注");
  });

  it("应识别【】形式的中文组前缀与开头多个空格", async () => {
    const { result, deps } = await renderPage();
    vi.mocked(deps.searchTorrentsUseCase.execute).mockResolvedValue(
      makeSearchResults(
        { title: NonEmptyStringSchema.parse("【字幕组】 某番 01") },
        { title: NonEmptyStringSchema.parse("[ANi]  某番 02") },
      ),
    );

    act(() =>
      result.current.search.performSearch("某番", [TORRENT_SEARCH_ENGINES[0]]),
    );

    await waitFor(() => {
      expect(result.current.results.groups).toHaveLength(2);
    });
    expect(result.current.results.groups[0].name).toBe("字幕组");
    expect(result.current.results.groups[1].name).toBe("ANi");
  });

  it("切换组折叠状态", async () => {
    const { result, deps } = await renderPage();
    vi.mocked(deps.searchTorrentsUseCase.execute).mockResolvedValue(
      makeSearchResults(
        { title: NonEmptyStringSchema.parse("[GroupA] 某番 01") },
        { title: NonEmptyStringSchema.parse("[GroupB] 某番 10") },
      ),
    );

    act(() =>
      result.current.search.performSearch("某番", [TORRENT_SEARCH_ENGINES[0]]),
    );
    await waitFor(() => expect(result.current.results.groups).toHaveLength(2));

    act(() => result.current.results.toggleGroup("GroupA"));
    expect(result.current.results.collapsedGroups.has("GroupA")).toBe(true);

    act(() => result.current.results.toggleGroup("GroupA"));
    expect(result.current.results.collapsedGroups.has("GroupA")).toBe(false);
  });

  it("全部折叠与全部展开", async () => {
    const { result, deps } = await renderPage();
    vi.mocked(deps.searchTorrentsUseCase.execute).mockResolvedValue(
      makeSearchResults(
        { title: NonEmptyStringSchema.parse("[GroupA] 某番 01") },
        { title: NonEmptyStringSchema.parse("[GroupB] 某番 10") },
      ),
    );

    act(() =>
      result.current.search.performSearch("某番", [TORRENT_SEARCH_ENGINES[0]]),
    );
    await waitFor(() => expect(result.current.results.groups).toHaveLength(2));
    expect(result.current.results.allGroupsCollapsed).toBe(false);

    act(() => result.current.results.handleToggleAllGroups());
    expect(result.current.results.allGroupsCollapsed).toBe(true);

    act(() => result.current.results.handleToggleAllGroups());
    expect(result.current.results.allGroupsCollapsed).toBe(false);
  });

  it("新一次搜索时应重置为全部展开", async () => {
    const { result, deps } = await renderPage();
    vi.mocked(deps.searchTorrentsUseCase.execute)
      .mockResolvedValueOnce(
        makeSearchResults(
          { title: NonEmptyStringSchema.parse("[GroupA] 某番 01") },
          { title: NonEmptyStringSchema.parse("[GroupB] 某番 10") },
        ),
      )
      .mockResolvedValueOnce(
        makeSearchResults(
          { title: NonEmptyStringSchema.parse("[GroupA] 新番 01") },
          { title: NonEmptyStringSchema.parse("[GroupB] 新番 10") },
        ),
      );

    act(() =>
      result.current.search.performSearch("某番", [TORRENT_SEARCH_ENGINES[0]]),
    );
    await waitFor(() => expect(result.current.results.groups).toHaveLength(2));

    act(() => result.current.results.handleToggleAllGroups());
    expect(result.current.results.allGroupsCollapsed).toBe(true);

    act(() =>
      result.current.search.performSearch("新番", [TORRENT_SEARCH_ENGINES[0]]),
    );
    await waitFor(() => {
      expect(result.current.results.allGroupsCollapsed).toBe(false);
    });
  });

  it("卸载重挂后保留搜索结果且不重复请求", async () => {
    const deps = makeDeps();
    vi.mocked(deps.searchTorrentsUseCase.execute).mockResolvedValue(
      makeSearchResults({ title: NonEmptyStringSchema.parse("xxx 第1集") }),
    );

    const first = await renderPage({ deps });
    act(() =>
      first.result.current.search.performSearch("xxx", [
        TORRENT_SEARCH_ENGINES[0],
      ]),
    );
    await waitFor(() => {
      expect(first.result.current.results.searchResults).toHaveLength(1);
    });
    const callsBeforeBack = vi.mocked(deps.searchTorrentsUseCase.execute).mock
      .calls.length;
    first.unmount();

    const second = await renderPage({ deps });
    expect(second.result.current.results.searchResults).toHaveLength(1);
    expect(
      vi.mocked(deps.searchTorrentsUseCase.execute).mock.calls.length,
    ).toBe(callsBeforeBack);
  });

  it("filter.setFilter 应暴露在返回值中", async () => {
    const { result } = await renderPage();
    expect(typeof result.current.filter.setFilter).toBe("function");
  });

  it("设置时间过滤后 filteredResults 应只包含时间范围内的项", async () => {
    const NOW = new Date("2026-07-01T12:00:00Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const { result, deps } = await renderPage();
    vi.mocked(deps.searchTorrentsUseCase.execute).mockResolvedValue(
      makeSearchResults(
        {
          title: NonEmptyStringSchema.parse("某番 01"),
          pub_date: "2026-07-01",
        },
        {
          title: NonEmptyStringSchema.parse("某番 02"),
          pub_date: "2026-05-01",
        },
      ),
    );

    act(() =>
      result.current.search.performSearch("某番", [TORRENT_SEARCH_ENGINES[0]]),
    );
    await waitFor(() =>
      expect(result.current.results.searchResults).toHaveLength(2),
    );

    act(() => result.current.filter.setFilter({ pubDatePreset: "week" }));

    expect(result.current.results.searchResults).toHaveLength(1);

    vi.restoreAllMocks();
  });

  it("过滤后 groups 应同步更新", async () => {
    const NOW = new Date("2026-07-01T12:00:00Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const { result, deps } = await renderPage();
    vi.mocked(deps.searchTorrentsUseCase.execute).mockResolvedValue(
      makeSearchResults(
        {
          title: NonEmptyStringSchema.parse("[GroupA] 某番 01"),
          pub_date: "2026-07-01",
        },
        {
          title: NonEmptyStringSchema.parse("[GroupA] 某番 02"),
          pub_date: "2026-05-01",
        },
        {
          title: NonEmptyStringSchema.parse("[GroupB] 其他番 01"),
          pub_date: "2026-05-01",
        },
      ),
    );

    act(() =>
      result.current.search.performSearch("某番", [TORRENT_SEARCH_ENGINES[0]]),
    );
    await waitFor(() => expect(result.current.results.groups).toHaveLength(2));

    act(() => result.current.filter.setFilter({ pubDatePreset: "week" }));

    expect(result.current.results.searchResults).toHaveLength(1);
    expect(result.current.results.groups).toHaveLength(1);
    expect(result.current.results.groups[0].name).toBe("GroupA");

    vi.restoreAllMocks();
  });

  it("无过滤条件时显示全部搜索结果", async () => {
    const { result, deps } = await renderPage();
    vi.mocked(deps.searchTorrentsUseCase.execute).mockResolvedValue(
      makeSearchResults(
        { title: NonEmptyStringSchema.parse("[GroupA] 某番 01") },
        { title: NonEmptyStringSchema.parse("[GroupB] 其他番 01") },
      ),
    );

    act(() =>
      result.current.search.performSearch("某番", [TORRENT_SEARCH_ENGINES[0]]),
    );
    await waitFor(() =>
      expect(result.current.results.searchResults).toHaveLength(2),
    );

    expect(result.current.results.searchResults).toHaveLength(2);
    expect(result.current.results.groups).toHaveLength(2);
  });

  it("多引擎搜索结果按 link 去重", async () => {
    const { result, deps } = await renderPage();
    const sameItem = makeSearchResults({
      title: NonEmptyStringSchema.parse("xxx 第1集"),
    })[0];

    vi.mocked(deps.searchTorrentsUseCase.execute)
      .mockResolvedValueOnce([sameItem])
      .mockResolvedValueOnce([
        { ...sameItem, title: NonEmptyStringSchema.parse("xxx 第1集 (重复)") },
      ]);

    act(() => result.current.search.performSearch("xxx", ["dmhy", "nyaa"]));

    await waitFor(() => {
      expect(result.current.results.searchResults).toHaveLength(1);
    });
  });
});

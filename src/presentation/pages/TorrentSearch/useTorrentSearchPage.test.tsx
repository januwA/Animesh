import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode, SubmitEvent } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import {
  TORRENT_SEARCH_ENGINES,
  type TorrentSearchEngine,
} from "@/domain/torrent/TorrentEngines";
import type { SearchResultItem } from "@/domain/torrent/TorrentSchemas";
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
  return items.map((item) => ({
    link: NonEmptyStringSchema.parse("http://example.com/1"),
    pub_date: "2026-06-23",
    magnet: NonEmptyStringSchema.parse("magnet:?xt=urn:btih:TEST1"),
    description: "",
    ...item,
  }));
}

const makeAiConfig = (): AiConfig => ({
  alias: NonEmptyStringSchema.parse("Test AI"),
  api_endpoint: NonEmptyStringSchema.parse("https://api.openai.com/v1"),
  api_key: NonEmptyStringSchema.parse("test-key"),
  ai_model: NonEmptyStringSchema.parse("gpt-3.5-turbo"),
});

const makeDeps = (
  overrides: Partial<UseTorrentSearchPageDeps> = {},
): UseTorrentSearchPageDeps => ({
  searchTorrentsUseCase: {
    execute: vi.fn().mockResolvedValue([]),
  },
  searchTorrentsWithAiUseCase: {
    execute: vi.fn().mockResolvedValue([]),
  },
  getSettingsUseCase: {
    execute: vi.fn().mockResolvedValue({ download_dir: "/mock" }),
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

  it("传统模式下搜索调用 searchTorrentsUseCase 并携带默认引擎", async () => {
    const { result, deps } = await renderPage();

    act(() => result.current.search.performSearch("xxx"));

    await waitFor(() => {
      expect(
        vi.mocked(deps.searchTorrentsUseCase.execute),
      ).toHaveBeenCalledWith(
        expect.any(Object),
        searchDto("xxx", TORRENT_SEARCH_ENGINES[0]),
      );
    });
  });

  it("切换搜索引擎后搜索携带对应引擎", async () => {
    const { result, deps } = await renderPage();

    act(() => result.current.search.setSearchEngine("bangumi_moe"));
    act(() => result.current.search.performSearch("xxx"));

    await waitFor(() => {
      expect(
        vi.mocked(deps.searchTorrentsUseCase.execute),
      ).toHaveBeenCalledWith(
        expect.any(Object),
        searchDto("xxx", "bangumi_moe"),
      );
    });
  });

  it("handleSearch 应使用输入框关键词（去除首尾空白）执行搜索", async () => {
    const { result, deps } = await renderPage();

    act(() => result.current.search.setSearchKeyword("  xxx  "));
    act(() =>
      result.current.search.handleSearch({
        preventDefault: vi.fn(),
      } as unknown as SubmitEvent),
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

  it("搜索成功时更新结果与历史记录，失败时清空结果", async () => {
    const { result, deps } = await renderPage();
    vi.mocked(deps.searchTorrentsUseCase.execute).mockResolvedValueOnce(
      makeSearchResults({ title: NonEmptyStringSchema.parse("xxx 第1集") }),
    );

    act(() => result.current.search.performSearch("xxx"));

    await waitFor(() => {
      expect(result.current.results.searchResults).toHaveLength(1);
    });
    expect(result.current.status.searchHasSearched).toBe(true);
    expect(result.current.searchHistory.history).toEqual(["xxx"]);

    vi.mocked(deps.searchTorrentsUseCase.execute).mockRejectedValueOnce(
      new Error("boom"),
    );
    act(() => result.current.search.performSearch("yyy"));

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

    act(() => result.current.search.performSearch("xxx"));
    await waitFor(() => expect(result.current.status.error).not.toBeNull());

    act(() => result.current.search.performSearch("xxx"));
    await waitFor(() => expect(result.current.status.error).toBeNull());
    expect(result.current.results.searchResults).toHaveLength(1);
  });

  it("搜索返回空结果时 searchResults 应为空数组且标记已搜索", async () => {
    const { result } = await renderPage();

    act(() => result.current.search.performSearch("xxx"));

    await waitFor(() => {
      expect(result.current.results.searchResults).toEqual([]);
    });
    expect(result.current.status.searchHasSearched).toBe(true);
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

  it("选择 AI 别名时持久化到 localStorage", async () => {
    const { result } = await renderPage();

    act(() => result.current.ai.handleSelectAiAlias("Test AI"));

    expect(result.current.ai.selectedAiAlias).toBe("Test AI");
    expect(localStorage.getItem("animesh_selected_ai_alias")).toBe("Test AI");
  });

  it("AI 模式下搜索调用 searchTorrentsWithAiUseCase", async () => {
    const { result, deps } = await renderPage();

    act(() => result.current.ai.handleSelectAiAlias("Test AI"));
    act(() => result.current.search.performSearch("昨日青空"));

    await waitFor(() => {
      expect(deps.searchTorrentsWithAiUseCase.execute).toHaveBeenCalledWith(
        expect.any(Object),
        {
          keyword: "昨日青空",
          engine: TORRENT_SEARCH_ENGINES[0],
          aiAlias: "Test AI",
        },
      );
    });
    expect(
      vi.mocked(deps.searchTorrentsUseCase.execute),
    ).not.toHaveBeenCalled();
  });

  it("getSettings 返回 ai_configs 时 aiConfigs 应随之更新", async () => {
    const { result } = await renderPage({
      deps: makeDeps({
        getSettingsUseCase: {
          execute: vi.fn().mockResolvedValue({
            download_dir: "/mock",
            ai_configs: [makeAiConfig()],
          }),
        },
      }),
    });

    await waitFor(() => {
      expect(result.current.ai.aiConfigs).toHaveLength(1);
    });
  });

  it("搜索时应将关键词加入历史记录（去重、置顶、不限数量）", async () => {
    const { result } = await renderPage();

    act(() => result.current.search.performSearch("xxx"));
    act(() => result.current.search.performSearch("柯南"));
    act(() => result.current.search.performSearch("xxx"));

    expect(result.current.searchHistory.history).toEqual(["xxx", "柯南"]);
    expect(
      JSON.parse(localStorage.getItem("animesh_search_history") || "[]"),
    ).toEqual(["xxx", "柯南"]);

    for (let i = 1; i <= 10; i++) {
      act(() => result.current.search.performSearch(`动漫_${i}`));
    }
    await act(async () => {});
    const historyList = JSON.parse(
      localStorage.getItem("animesh_search_history") || "[]",
    );
    expect(historyList.length).toBe(12);
    expect(historyList[0]).toBe("动漫_10");
  });

  it("应该从 localStorage 初始化历史记录，非法 JSON 降级为空数组", async () => {
    localStorage.setItem(
      "animesh_search_history",
      JSON.stringify(["xxx", "柯南"]),
    );
    const { result } = await renderPage();
    expect(result.current.searchHistory.history).toEqual(["xxx", "柯南"]);

    localStorage.setItem("animesh_search_history", "invalid-json{");
    const invalid = await renderPage();
    expect(invalid.result.current.searchHistory.history).toEqual([]);
  });

  it("删除单个历史记录项时更新列表与 localStorage", async () => {
    localStorage.setItem(
      "animesh_search_history",
      JSON.stringify(["xxx", "柯南"]),
    );
    const { result } = await renderPage();

    act(() => result.current.searchHistory.handleDeleteHistory("xxx"));

    expect(result.current.searchHistory.history).toEqual(["柯南"]);
    expect(
      JSON.parse(localStorage.getItem("animesh_search_history") || "[]"),
    ).toEqual(["柯南"]);
  });

  it("删除最后一项历史记录时移除 localStorage 键", async () => {
    localStorage.setItem("animesh_search_history", JSON.stringify(["xxx"]));
    const { result } = await renderPage();

    act(() => result.current.searchHistory.handleDeleteHistory("xxx"));

    expect(result.current.searchHistory.history).toEqual([]);
    expect(localStorage.getItem("animesh_search_history")).toBeNull();
  });

  it("清空历史记录时清空列表并移除 localStorage 键", async () => {
    localStorage.setItem(
      "animesh_search_history",
      JSON.stringify(["xxx", "柯南"]),
    );
    const { result } = await renderPage();

    act(() => result.current.searchHistory.handleClearHistory());

    expect(result.current.searchHistory.history).toEqual([]);
    expect(localStorage.getItem("animesh_search_history")).toBeNull();
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

    act(() =>
      result.current.results.handlePlay(
        "magnet:?xt=urn:btih:TEST1",
        "xxx 第1集",
      ),
    );

    expect(locationRef.current?.pathname).toBe("/torrent");
    expect(locationRef.current?.search).toContain("magnet=");
    expect(locationRef.current?.search).toContain("title=");
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

    act(() => result.current.search.performSearch("xxx"));
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

    act(() => result.current.search.performSearch("xxx"));
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

    act(() => result.current.search.performSearch("某番"));

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

    act(() => result.current.search.performSearch("某番"));

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

    act(() => result.current.search.performSearch("某番"));
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

    act(() => result.current.search.performSearch("某番"));
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

    act(() => result.current.search.performSearch("某番"));
    await waitFor(() => expect(result.current.results.groups).toHaveLength(2));

    act(() => result.current.results.handleToggleAllGroups());
    expect(result.current.results.allGroupsCollapsed).toBe(true);

    act(() => result.current.search.performSearch("新番"));
    await waitFor(() => {
      expect(result.current.results.allGroupsCollapsed).toBe(false);
    });
  });

  it("卸载重挂后保留搜索关键词与结果且不重复请求", async () => {
    const deps = makeDeps();
    vi.mocked(deps.searchTorrentsUseCase.execute).mockResolvedValue(
      makeSearchResults({ title: NonEmptyStringSchema.parse("xxx 第1集") }),
    );

    const first = await renderPage({ deps });
    act(() => first.result.current.search.setSearchKeyword("xxx"));
    act(() => first.result.current.search.performSearch("xxx"));
    await waitFor(() => {
      expect(first.result.current.results.searchResults).toHaveLength(1);
    });
    const callsBeforeBack = vi.mocked(deps.searchTorrentsUseCase.execute).mock
      .calls.length;
    first.unmount();

    const second = await renderPage({ deps });
    expect(second.result.current.search.searchKeyword).toBe("xxx");
    expect(second.result.current.results.searchResults).toHaveLength(1);
    expect(
      vi.mocked(deps.searchTorrentsUseCase.execute).mock.calls.length,
    ).toBe(callsBeforeBack);
  });
});

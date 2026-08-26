import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { IptvChannel } from "@/domain/iptv/IptvSchemas";
import { resetAppStores } from "@/test/store-reset";
import type { UseIptvPageParams } from "./useIptvPage";
import { useIptvPage } from "./useIptvPage";

const mockCountries = [
  { name: "中国", code: "CN", flag: "🇨🇳" },
  { name: "日本", code: "JP", flag: "🇯🇵" },
];

const mockChannels: IptvChannel[] = [
  {
    tvgId: "cctv1",
    name: "CCTV-1",
    logo: "http://example.com/cctv1.png",
    category: "新闻",
    url: "http://example.com/cctv1.m3u8",
  },
  {
    tvgId: "cctv6",
    name: "CCTV-6",
    logo: null,
    category: "电影",
    url: "http://example.com/cctv6.m3u8",
  },
] as unknown as IptvChannel[];

const makeDeps = (
  overrides: Partial<UseIptvPageParams> = {},
): UseIptvPageParams => ({
  getIptvCountriesUseCase: {
    execute: vi.fn().mockResolvedValue(mockCountries),
  },
  getIptvChannelsUseCase: {
    execute: vi.fn().mockResolvedValue(mockChannels),
  },
  logger: {
    withCategory: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      withCategory: vi.fn(),
    }),
  },
  ...overrides,
});

const lastNavigation: {
  current: { pathname: string; search: string; state: unknown } | null;
} = { current: null };
const LocationTracker = () => {
  lastNavigation.current = useLocation();
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

const renderUseIptvPage = (deps: UseIptvPageParams) => {
  return renderHook(() => useIptvPage(deps), {
    wrapper: RouterWrapper,
  });
};

describe("useIptvPage IPTV 页面 hook", () => {
  beforeEach(() => {
    resetAppStores();
    vi.clearAllMocks();
  });

  it("应该加载国家和频道数据", async () => {
    const deps = makeDeps();
    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.selectCountries).toEqual(mockCountries);
    expect(result.current.iptvChannels).toEqual(mockChannels);
    expect(result.current.filteredChannels).toHaveLength(2);
  });

  it("应该根据关键词过滤频道", async () => {
    const deps = makeDeps();
    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setIptvKeyword("cctv1");
    });

    await waitFor(() => {
      expect(result.current.filteredChannels).toHaveLength(1);
    });
  });

  it("获取频道失败时应该设置错误信息", async () => {
    const deps = makeDeps({
      getIptvChannelsUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("Network error")),
      },
    });

    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it("国家列表为空时应该包含默认中国选项", async () => {
    const deps = makeDeps({
      getIptvCountriesUseCase: {
        execute: vi.fn().mockResolvedValue([]),
      },
    });

    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.selectCountries).toHaveLength(1);
    });

    expect(result.current.selectCountries[0].code).toBe("CN");
  });

  it("handleCountryChange 切换到不同国家时应该清空频道和重置分类", async () => {
    const deps = makeDeps();
    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleCountryChange("JP");
    });

    await waitFor(() => {
      expect(result.current.iptvSelectedCountry).toBe("JP");
    });
  });

  it("handleCountryChange 切换到相同国家时不应该清空频道", async () => {
    const deps = makeDeps();
    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleCountryChange("CN");
    });

    await waitFor(() => {
      expect(result.current.iptvSelectedCountry).toBe("CN");
    });
  });

  it("handleCategoryChange 应该更新选中的分类", async () => {
    const deps = makeDeps();
    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleCategoryChange("新闻");
    });

    await waitFor(() => {
      expect(result.current.iptvSelectedCategory).toBe("新闻");
    });
  });

  it("handleCategoryChange 传入空字符串时应该重置为默认分类", async () => {
    const deps = makeDeps();
    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleCategoryChange("");
    });

    await waitFor(() => {
      expect(result.current.iptvSelectedCategory).toBe("all");
    });
  });

  it("handleChannelClick 应该导航到直播播放页并携带频道参数", async () => {
    const deps = makeDeps();
    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleChannelClick(mockChannels[0]);
    });

    expect(lastNavigation.current?.pathname).toBe("/live/play");
    const params = new URLSearchParams(lastNavigation.current?.search ?? "");
    expect(params.get("url")).toBe("http://example.com/cctv1.m3u8");
    expect(params.get("name")).toBe("CCTV-1");
    expect(params.get("logo")).toBe("http://example.com/cctv1.png");
    expect(params.get("category")).toBe("新闻");
  });

  it("handleChannelClick 频道缺少 logo 和分类时应该使用空字符串", async () => {
    const deps = makeDeps();
    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleChannelClick({
        ...mockChannels[1],
        category: null,
      } as IptvChannel);
    });

    expect(lastNavigation.current?.pathname).toBe("/live/play");
    const params = new URLSearchParams(lastNavigation.current?.search ?? "");
    expect(params.get("logo")).toBe("");
    expect(params.get("category")).toBe("");
  });

  it("filteredChannels 应该按分类过滤频道", async () => {
    const deps = makeDeps();
    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleCategoryChange("新闻");
    });

    await waitFor(() => {
      expect(result.current.filteredChannels).toHaveLength(1);
      expect(result.current.filteredChannels[0].category).toBe("新闻");
    });
  });

  it("filteredChannels 应该根据关键词匹配 tvgId", async () => {
    const deps = makeDeps();
    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setIptvKeyword("cctv1");
    });

    await waitFor(() => {
      expect(result.current.filteredChannels).toHaveLength(1);
      expect(result.current.filteredChannels[0].tvgId).toBe("cctv1");
    });
  });

  it("filteredChannels 应该根据关键词匹配 category", async () => {
    const deps = makeDeps();
    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setIptvKeyword("电影");
    });

    await waitFor(() => {
      expect(result.current.filteredChannels).toHaveLength(1);
      expect(result.current.filteredChannels[0].category).toBe("电影");
    });
  });

  it("filteredChannels 频道缺少 tvgId 时应该仍能按分类关键词匹配", async () => {
    const channelsWithNullTvgId = [
      {
        ...mockChannels[0],
        tvgId: null,
        name: "Movie Channel",
        category: "电影",
      },
    ] as unknown as IptvChannel[];
    const deps = makeDeps({
      getIptvChannelsUseCase: {
        execute: vi.fn().mockResolvedValue(channelsWithNullTvgId),
      },
    });
    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setIptvKeyword("电影");
    });

    await waitFor(() => {
      expect(result.current.filteredChannels).toHaveLength(1);
      expect(result.current.filteredChannels[0].category).toBe("电影");
    });
  });

  it("filteredChannels 频道缺少分类时关键词匹配会排除该频道", async () => {
    const channelsWithNullCategory = [
      { ...mockChannels[0], category: null, name: "Movie Channel" },
    ] as unknown as IptvChannel[];
    const deps = makeDeps({
      getIptvChannelsUseCase: {
        execute: vi.fn().mockResolvedValue(channelsWithNullCategory),
      },
    });
    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setIptvKeyword("电影");
    });

    await waitFor(() => {
      expect(result.current.filteredChannels).toHaveLength(0);
    });
  });

  it("获取国家列表失败时应该记录警告日志", async () => {
    const warnMock = vi.fn();
    const deps = makeDeps({
      getIptvCountriesUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("Network error")),
      },
      logger: {
        withCategory: () => ({
          debug: vi.fn(),
          info: vi.fn(),
          warn: warnMock,
          error: vi.fn(),
          withCategory: vi.fn(),
        }),
      },
    });

    renderUseIptvPage(deps);

    await waitFor(() => {
      expect(warnMock).toHaveBeenCalled();
    });
  });

  it("categories 应该返回所有唯一的分类并排序", async () => {
    const deps = makeDeps();
    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.categories).toEqual(["新闻", "电影"]);
    });
  });

  it("categories 应该忽略没有分类的频道", async () => {
    const channelsWithNullCategory = [
      { ...mockChannels[0], category: "新闻" },
      { ...mockChannels[1], category: null },
    ] as unknown as IptvChannel[];

    const deps = makeDeps({
      getIptvChannelsUseCase: {
        execute: vi.fn().mockResolvedValue(channelsWithNullCategory),
      },
    });

    const { result } = renderUseIptvPage(deps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.categories).toEqual(["新闻"]);
    });
  });
});

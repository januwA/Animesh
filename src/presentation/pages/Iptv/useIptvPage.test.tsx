import { act, renderHook, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
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

const RouterWrapper = ({ children }: { children: React.ReactNode }) => {
  const router = createMemoryRouter([{ path: "/", element: children }]);
  return <RouterProvider router={router} />;
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
});

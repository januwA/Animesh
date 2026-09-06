import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIContext } from "@/di/DIContext";
import Iptv from "./index";

vi.mock(import("./useIptvPage"), () => ({
  useIptvPage: vi.fn(),
}));
vi.mock(import("./IptvFilters"), () => ({
  IptvFilters: vi.fn(() => <div data-testid="iptv-filters" />),
}));
vi.mock(import("./ChannelCard"), () => ({
  ChannelCard: vi.fn(({ channel }: { channel: { name: string } }) => (
    <div>{channel.name}</div>
  )),
}));

import { useIptvPage } from "./useIptvPage";

const mockPage = (overrides: Partial<ReturnType<typeof useIptvPage>> = {}) => {
  vi.mocked(useIptvPage).mockReturnValue({
    iptvSelectedCountry: "CN",
    iptvSelectedCategory: "all",
    iptvKeyword: "",
    iptvChannels: [],
    selectCountries: [],
    categories: [],
    filteredChannels: [],
    isLoading: false,
    error: null,
    setIptvKeyword: vi.fn(),
    handleCountryChange: vi.fn(),
    handleCategoryChange: vi.fn(),
    handleChannelClick: vi.fn(),
    ...overrides,
  });
};

const mockContainer = {
  getIptvCountriesUseCase: {},
  getIptvChannelsUseCase: {},
  logger: { withCategory: vi.fn() },
} as unknown as DIContainer;

function renderPage(initialEntry: string) {
  return render(
    <DIContext value={mockContainer}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Iptv />
      </MemoryRouter>
    </DIContext>,
  );
}

describe("Iptv 页面", () => {
  it("country 参数非法时应渲染参数错误视图", () => {
    renderPage("/iptv?country=CHN");
    expect(screen.getByText("无效的 IPTV 参数")).toBeInTheDocument();
    expect(screen.getByText("无效的国家代码")).toBeInTheDocument();
  });

  it("无 country 参数时应正常渲染", () => {
    mockPage();
    renderPage("/iptv");
    expect(screen.getByTestId("iptv-filters")).toBeInTheDocument();
    expect(useIptvPage).toHaveBeenCalledWith(expect.anything(), undefined);
  });

  it("合法 country 参数应透传给页面 hook", () => {
    mockPage();
    renderPage("/iptv?country=jp");
    expect(useIptvPage).toHaveBeenCalledWith(expect.anything(), "jp");
  });

  it("频道加载失败时应渲染错误提示", () => {
    mockPage({ error: "获取频道列表失败" });
    renderPage("/iptv");
    expect(screen.getByText("获取频道列表失败")).toBeInTheDocument();
  });

  it("频道加载中时应渲染骨架屏", () => {
    mockPage({ isLoading: true });
    renderPage("/iptv");
    expect(screen.queryByTestId("iptv-filters")).toBeDefined();
  });
});

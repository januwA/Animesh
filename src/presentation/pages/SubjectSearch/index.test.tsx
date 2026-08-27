import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DIContainer, DIContext } from "@/di/DIContext";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import SubjectSearch from "./index";
import { useSubjectSearchPage } from "./useSubjectSearchPage";

vi.mock(import("./useSubjectSearchPage"), () => ({
  useSubjectSearchPage: vi.fn(),
}));

const mockPageReturn = {
  search: {
    keyword: "测试动画",
    setKeyword: vi.fn(),
    handleSearch: vi.fn(),
    performSearch: vi.fn(),
  },
  results: {
    items: [],
    handleSubjectClick: vi.fn(),
    onLoadMore: vi.fn(),
  },
  status: {
    loading: false,
    error: null as Error | null,
    hasSearched: false,
    hasMore: false,
    loadingMore: false,
    handleCancel: vi.fn(),
  },
};

const mockDI = {
  searchBangumiSubjectsUseCase: { execute: vi.fn() },
  searchAnilistSubjectsUseCase: { execute: vi.fn() },
} as unknown as DIContainer;

function renderWithProviders(
  ui: ReactNode,
  initialEntries: string[] = ["/search"],
) {
  return render(
    <DIContext value={mockDI}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/search" element={ui} />
        </Routes>
      </MemoryRouter>
    </DIContext>,
  );
}

describe("SubjectSearch 组件", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSubjectSearchPage).mockReturnValue(mockPageReturn as any);
  });

  it("默认渲染 Bangumi 搜索标题与描述", () => {
    renderWithProviders(<SubjectSearch />);

    expect(
      screen.getByRole("heading", { name: "Bangumi 搜索" }),
    ).toBeInTheDocument();
    expect(screen.getByText("搜索 Bangumi 动漫条目")).toBeInTheDocument();
    expect(useSubjectSearchPage).toHaveBeenCalledWith(
      undefined,
      { searchSubjectsUseCase: mockDI.searchBangumiSubjectsUseCase },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("当 platform='anilist' 时渲染 AniList 搜索标题与描述并注入 anilist useCase", () => {
    renderWithProviders(<SubjectSearch platform="anilist" />);

    expect(
      screen.getByRole("heading", { name: "AniList 搜索" }),
    ).toBeInTheDocument();
    expect(screen.getByText("搜索 AniList 动漫条目")).toBeInTheDocument();
    expect(useSubjectSearchPage).toHaveBeenCalledWith(
      undefined,
      { searchSubjectsUseCase: mockDI.searchAnilistSubjectsUseCase },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("传递非法 platform 参数时渲染 InvalidParamsView", () => {
    renderWithProviders(
      <SubjectSearch platform={"invalid_platform" as AnimePlatform} />,
    );

    expect(screen.getByText("无效的平台参数")).toBeInTheDocument();
  });

  it("URL 包含空白关键词时渲染 InvalidParamsView", () => {
    renderWithProviders(<SubjectSearch />, ["/search?keyword=%20%20"]);

    expect(screen.getByText("无效的搜索参数")).toBeInTheDocument();
  });

  it("加载中时渲染 SubjectSearchLoading 并支持取消", () => {
    vi.mocked(useSubjectSearchPage).mockReturnValue({
      ...mockPageReturn,
      status: {
        ...mockPageReturn.status,
        loading: true,
      },
    } as any);

    renderWithProviders(<SubjectSearch />);

    const cancelButton = screen.getByRole("button", { name: "取消搜索" });
    expect(cancelButton).toBeInTheDocument();
    fireEvent.click(cancelButton);
    expect(mockPageReturn.status.handleCancel).toHaveBeenCalled();
  });

  it("搜索出错时渲染 ErrorState 并支持重试", () => {
    vi.mocked(useSubjectSearchPage).mockReturnValue({
      ...mockPageReturn,
      status: {
        ...mockPageReturn.status,
        error: new Error("网络错误"),
      },
    } as any);

    renderWithProviders(<SubjectSearch />);

    expect(screen.getByText("搜索失败")).toBeInTheDocument();
    expect(screen.getByText("网络错误")).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: "重试" });
    fireEvent.click(retryButton);
    expect(mockPageReturn.search.performSearch).toHaveBeenCalledWith(
      "测试动画",
    );
  });

  it("搜索完成且有结果时渲染 SubjectSearchResults", () => {
    const items = [
      {
        id: 123,
        name: "测试条目",
        summary: "这是简介",
        image: "https://example.com/test.jpg",
        rating: 9.0,
      },
    ];

    vi.mocked(useSubjectSearchPage).mockReturnValue({
      ...mockPageReturn,
      results: {
        ...mockPageReturn.results,
        items,
      },
      status: {
        ...mockPageReturn.status,
        hasSearched: true,
      },
    } as any);

    renderWithProviders(<SubjectSearch />);

    expect(screen.getByText("测试条目")).toBeInTheDocument();
  });
});

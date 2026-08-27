import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DIContainer, DIContext } from "@/di/DIContext";
import type {
  AnimePlatform,
  NextSeasonData,
} from "@/domain/anime/AnimeSchemas";
import NextSeasonAnime from "./index";
import { useNextSeasonPage } from "./useNextSeasonPage";

vi.mock(import("./useNextSeasonPage"), () => ({
  useNextSeasonPage: vi.fn(),
}));

vi.mock(import("./MonthCalendar"), () => ({
  MonthCalendar: ({ groups }: { groups: NextSeasonData }) => (
    <div data-testid="month-calendar">
      {groups.map((g) => (
        <span key={g.month}>{g.label}</span>
      ))}
    </div>
  ),
}));

const mockPageReturn = {
  data: [] as NextSeasonData,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
  handleAnimeClick: vi.fn(),
};

const mockDI = {
  getBangumiNextSeasonUseCase: { execute: vi.fn() },
  getAnilistNextSeasonUseCase: { execute: vi.fn() },
} as unknown as DIContainer;

function renderWithProviders(ui: ReactNode) {
  return render(
    <DIContext value={mockDI}>
      <MemoryRouter>{ui}</MemoryRouter>
    </DIContext>,
  );
}

describe("NextSeasonAnime 组件", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNextSeasonPage).mockReturnValue(mockPageReturn);
  });

  it("默认渲染 Bangumi 下季新番标题并注入 bangumi UseCase", () => {
    renderWithProviders(<NextSeasonAnime />);

    expect(
      screen.getByRole("heading", { name: "下季新番" }),
    ).toBeInTheDocument();
    expect(useNextSeasonPage).toHaveBeenCalledWith(
      { getNextSeasonUseCase: mockDI.getBangumiNextSeasonUseCase },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("platform='anilist' 时渲染 AniList 标题并注入 anilist UseCase", () => {
    renderWithProviders(<NextSeasonAnime platform="anilist" />);

    expect(
      screen.getByRole("heading", { name: "AniList 下季新番" }),
    ).toBeInTheDocument();
    expect(useNextSeasonPage).toHaveBeenCalledWith(
      { getNextSeasonUseCase: mockDI.getAnilistNextSeasonUseCase },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("传递非法 platform 参数时渲染 InvalidParamsView", () => {
    renderWithProviders(
      <NextSeasonAnime platform={"invalid_platform" as AnimePlatform} />,
    );

    expect(screen.getByText("无效的平台参数")).toBeInTheDocument();
  });

  it("加载中时渲染 CalendarSkeleton", () => {
    vi.mocked(useNextSeasonPage).mockReturnValue({
      ...mockPageReturn,
      isLoading: true,
    });

    renderWithProviders(<NextSeasonAnime />);

    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("错误时渲染 ErrorState 并支持重试", () => {
    vi.mocked(useNextSeasonPage).mockReturnValue({
      ...mockPageReturn,
      error: new Error("获取失败"),
    });

    renderWithProviders(<NextSeasonAnime platform="anilist" />);

    expect(screen.getByText("获取 AniList 下季新番失败")).toBeInTheDocument();
    expect(screen.getByText("获取失败")).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: "重试" });
    fireEvent.click(retryBtn);
    expect(mockPageReturn.refetch).toHaveBeenCalled();
  });

  it("数据为空时渲染 Empty", () => {
    vi.mocked(useNextSeasonPage).mockReturnValue({
      ...mockPageReturn,
      data: [],
    });

    renderWithProviders(<NextSeasonAnime />);

    expect(screen.getByText("未找到下季新番数据")).toBeInTheDocument();
  });

  it("有数据时渲染 MonthCalendar", () => {
    vi.mocked(useNextSeasonPage).mockReturnValue({
      ...mockPageReturn,
      data: [
        {
          month: 10,
          label: "10月",
          items: [],
        },
      ],
    });

    renderWithProviders(<NextSeasonAnime />);

    expect(screen.getByTestId("month-calendar")).toBeInTheDocument();
    expect(screen.getByText("10月")).toBeInTheDocument();
  });
});

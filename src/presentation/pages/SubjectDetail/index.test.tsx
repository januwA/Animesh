import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DIContainer, DIContext } from "@/di/DIContext";
import type { AnimePlatform, AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { TorrentStatusContext } from "@/presentation/context/TorrentStatusContext";
import SubjectDetail from "./index";
import { useSubjectDetail } from "./useSubjectDetail";

vi.mock("./useSubjectDetail", () => ({
  useSubjectDetail: vi.fn(),
}));

vi.mock("@/presentation/components/SubjectInfoCard", () => ({
  SubjectInfoCard: ({
    displayName,
    platform,
  }: {
    displayName: string;
    platform: AnimePlatform;
  }) => (
    <div data-testid="subject-info-card">
      <span>{displayName}</span>
      <span>{platform}</span>
    </div>
  ),
}));

const mockSubject: AnimeSubject = {
  id: 123,
  name: "测试动漫",
  summary: "这是简介",
  image: "http://example.com/test.jpg",
  rating: 8.5,
  date: "2026-07-01",
  eps: 12,
  platform: "TV",
};

const mockDetailReturn = {
  info: {
    subject: mockSubject,
    displayName: "测试动漫",
    imageUrl: "http://example.com/test.jpg",
    handleOpenUrl: vi.fn(),
    subjectQuery: {
      data: mockSubject,
      loading: false,
      error: null as string | null,
      refetch: vi.fn(),
    },
  },
  episodes: {
    episodes: [],
    totalEpisodes: 0,
    totalPages: 1,
    todayStr: "2026-07-01",
    episodesQuery: {
      loading: false,
      error: null,
      refetch: vi.fn(),
    },
    handleEpisodeClick: vi.fn(),
    changePage: vi.fn(),
    jumpToEpisode: vi.fn(),
  },
  cast: {
    characters: [],
    persons: [],
    consolidatedStaff: [],
    staffGroupedByRole: new Map(),
    charactersQuery: {
      loading: false,
      error: null,
      refetch: vi.fn(),
    },
    personsQuery: {
      loading: false,
      error: null,
      refetch: vi.fn(),
    },
  },
  resources: {
    boundTorrents: [],
    unboundTorrents: [],
    boundResourcesCount: 0,
    bindLoading: false,
    unbindLoading: false,
    handleBind: vi.fn(),
    handleUnbind: vi.fn(),
  },
};

const mockDI = {
  getBangumiSubjectUseCase: { execute: vi.fn() },
  getBangumiEpisodesUseCase: { execute: vi.fn() },
  getBangumiPersonsUseCase: { execute: vi.fn() },
  getBangumiCharactersUseCase: { execute: vi.fn() },
  getAnilistSubjectUseCase: { execute: vi.fn() },
  getAnilistEpisodesUseCase: { execute: vi.fn() },
  getAnilistPersonsUseCase: { execute: vi.fn() },
  getAnilistCharactersUseCase: { execute: vi.fn() },
  getFavoriteStatusUseCase: { execute: vi.fn() },
  addFavoriteUseCase: { execute: vi.fn() },
  removeFavoriteUseCase: { execute: vi.fn() },
  openUrlUseCase: { execute: vi.fn() },
  setTorrentSubjectUseCase: { execute: vi.fn() },
  clearTorrentSubjectUseCase: { execute: vi.fn() },
} as unknown as DIContainer;

function renderWithProviders(
  ui: ReactNode,
  initialEntries: string[] = ["/subject/123"],
  path = "/subject/:subjectId",
) {
  return render(
    <DIContext value={mockDI}>
      <TorrentStatusContext
        value={{
          torrents: [],
          isLoading: false,
        }}
      >
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path={path} element={ui} />
          </Routes>
        </MemoryRouter>
      </TorrentStatusContext>
    </DIContext>,
  );
}

describe("SubjectDetail 组件", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSubjectDetail).mockReturnValue(mockDetailReturn as any);
  });

  it("默认 (bangumi) 注入 bangumi 专属 UseCase", () => {
    renderWithProviders(<SubjectDetail />);

    expect(useSubjectDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectId: 123,
        page: 1,
        platform: "bangumi",
      }),
      expect.objectContaining({
        getSubjectUseCase: mockDI.getBangumiSubjectUseCase,
        getEpisodesUseCase: mockDI.getBangumiEpisodesUseCase,
        getPersonsUseCase: mockDI.getBangumiPersonsUseCase,
        getCharactersUseCase: mockDI.getBangumiCharactersUseCase,
      }),
    );
    expect(screen.getByText("测试动漫")).toBeInTheDocument();
  });

  it("platform='anilist' 时注入 anilist 专属 UseCase", () => {
    renderWithProviders(
      <SubjectDetail platform="anilist" />,
      ["/anilist/subject/456"],
      "/anilist/subject/:subjectId",
    );

    expect(useSubjectDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectId: 456,
        page: 1,
        platform: "anilist",
      }),
      expect.objectContaining({
        getSubjectUseCase: mockDI.getAnilistSubjectUseCase,
        getEpisodesUseCase: mockDI.getAnilistEpisodesUseCase,
        getPersonsUseCase: mockDI.getAnilistPersonsUseCase,
        getCharactersUseCase: mockDI.getAnilistCharactersUseCase,
      }),
    );
  });

  it("传递非法 platform 参数时渲染 InvalidParamsView", () => {
    renderWithProviders(
      <SubjectDetail platform={"invalid_platform" as AnimePlatform} />,
    );

    expect(screen.getByText("无效的平台参数")).toBeInTheDocument();
  });

  it("缺少或非法的 subjectId 参数时渲染 InvalidParamsView", () => {
    renderWithProviders(<SubjectDetail />, ["/subject/abc"]);

    expect(screen.getByText("无效的条目详情参数")).toBeInTheDocument();
  });

  it("非法的 page 参数时渲染 InvalidParamsView", () => {
    renderWithProviders(<SubjectDetail />, ["/subject/123?page=notanumber"]);

    expect(screen.getByText("无效的条目详情参数")).toBeInTheDocument();
  });

  it("动漫详情加载失败时根据 platform 显示对应错误标题", () => {
    vi.mocked(useSubjectDetail).mockReturnValue({
      ...mockDetailReturn,
      info: {
        ...mockDetailReturn.info,
        subjectQuery: {
          ...mockDetailReturn.info.subjectQuery,
          error: "网络错误",
        },
      },
    } as any);

    renderWithProviders(<SubjectDetail platform="anilist" />);

    expect(screen.getByText("获取 AniList 动漫详情失败")).toBeInTheDocument();
    expect(screen.getByText("网络错误")).toBeInTheDocument();
  });
});

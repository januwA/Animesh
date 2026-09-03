import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import type { AnimeEpisode, AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { EpisodesSection } from "./EpisodesSection";
import type {
  SubjectEpisodesResult,
  UseSubjectEpisodesDeps,
} from "./useSubjectEpisodes";
import { useSubjectEpisodes } from "./useSubjectEpisodes";

vi.mock(import("./useSubjectEpisodes"), () => ({
  useSubjectEpisodes: vi.fn(),
}));

const mockedUseSubjectEpisodes = vi.mocked(useSubjectEpisodes);

const makeEpisode = (sort: number): AnimeEpisode => ({
  id: 1000 + sort,
  sort,
  name: `第 ${sort} 集`,
  airdate: "2026-07-01",
});

const makeSubject = (): AnimeSubject => ({
  id: 123,
  name: "测试动漫",
  summary: "简介",
  image: "",
  rating: 8.5,
  date: null as never,
  eps: 12,
  platform: "TV",
});

const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const makeDeps = (): UseSubjectEpisodesDeps => ({
  getAnimeEpisodesUseCase: { execute: vi.fn() },
});

const makeResult = (
  episodes: AnimeEpisode[] = [],
  overrides: Partial<SubjectEpisodesResult> = {},
): SubjectEpisodesResult => ({
  episodesQuery: {
    data: { items: episodes, total: episodes.length },
    loading: false,
    error: null,
    refetch: vi.fn(),
  },
  episodes,
  totalEpisodes: episodes.length,
  totalPages: 1,
  todayStr: formatDate(new Date()),
  handleEpisodeClick: vi.fn(),
  changePage: vi.fn(),
  jumpToEpisode: vi.fn(),
  ...overrides,
});

const renderSection = (result: SubjectEpisodesResult) => {
  mockedUseSubjectEpisodes.mockReturnValue(result);
  return render(
    <EpisodesSection
      subjectId={123}
      page={1}
      subject={makeSubject()}
      deps={makeDeps()}
    />,
  );
};

describe("EpisodesSection 剧集列表组件", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该渲染剧集卡片", () => {
    renderSection(makeResult([makeEpisode(1), makeEpisode(2)]));

    expect(screen.getByText("第 1 集")).toBeInTheDocument();
    expect(screen.getByText("第 2 集")).toBeInTheDocument();
    expect(screen.getByText("共 2 集")).toBeInTheDocument();
  });

  it("当没有剧集时，应该显示空状态提示", () => {
    renderSection(makeResult());

    expect(screen.getByText("暂无剧集数据")).toBeInTheDocument();
  });

  it("点击剧集卡片时，应该调用 handleEpisodeClick", () => {
    const handleEpisodeClick = vi.fn();
    const ep = makeEpisode(1);
    renderSection(makeResult([ep], { totalEpisodes: 1, handleEpisodeClick }));

    fireEvent.click(screen.getByText("第 1 集").closest("button")!);

    expect(handleEpisodeClick).toHaveBeenCalledWith(ep);
  });

  it("如果当前时间 >= ep.airdate，剧集卡片应该使用主色样式；否则使用普通样式", () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const future = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    renderSection(
      makeResult([
        {
          ...makeEpisode(1),
          name: "已播出剧集",
          airdate: formatDate(yesterday),
        },
        {
          ...makeEpisode(2),
          name: "未播出剧集",
          airdate: formatDate(future),
        },
      ]),
    );

    const airedCard = screen.getByText("已播出剧集").closest("button");
    const unairedCard = screen.getByText("未播出剧集").closest("button");

    expect(airedCard!.className).toContain("bg-primary/5");
    expect(airedCard!.className).toContain("border-primary/20");
    expect(unairedCard!.className).toContain("bg-card");
    expect(unairedCard!.className).toContain("border-border");
  });

  it("当有错误时，应该显示错误状态并可重试", () => {
    const refetch = vi.fn();
    renderSection(
      makeResult([], {
        episodesQuery: {
          data: null,
          loading: false,
          error: new Error("Episodes API Error"),
          refetch,
        },
      }),
    );

    expect(screen.getByText("获取剧集列表失败")).toBeInTheDocument();
    expect(screen.getByText("Episodes API Error")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it("加载中时应该显示骨架屏", () => {
    const { container } = renderSection(
      makeResult([], {
        episodesQuery: {
          data: null,
          loading: true,
          error: null,
          refetch: vi.fn(),
        },
      }),
    );

    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("总页数大于 1 时，应该显示分页组件", () => {
    renderSection(
      makeResult(
        Array.from({ length: 50 }, (_, i) => makeEpisode(i + 1)),
        {
          totalEpisodes: 103,
          totalPages: 3,
        },
      ),
    );

    expect(screen.getByText("共 103 集")).toBeInTheDocument();
  });

  it("总页数为 1 时，不应该显示分页组件", () => {
    renderSection(makeResult([makeEpisode(1)], { totalEpisodes: 1 }));

    expect(screen.getByText("共 1 集")).toBeInTheDocument();
  });
});

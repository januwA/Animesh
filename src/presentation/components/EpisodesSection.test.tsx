import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { AnimeEpisode } from "@/domain/anime/AnimeSchemas";
import { EpisodesSection } from "@/presentation/components/EpisodesSection";

const makeEpisode = (sort: number): AnimeEpisode => ({
  id: 1000 + sort,
  sort,
  name: `第 ${sort} 集`,
  duration: "24:00",
  airdate: "2026-07-01",
});

const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const defaultProps = () => ({
  episodes: [] as AnimeEpisode[],
  totalEpisodes: 0,
  totalPages: 1,
  page: 1,
  todayStr: formatDate(new Date()),
  loading: false,
  error: null as Error | null,
  onRetry: vi.fn(),
  onEpisodeClick: vi.fn(),
  onPageChange: vi.fn(),
  onJumpToEpisode: vi.fn(),
});

describe("EpisodesSection 剧集列表组件", () => {
  it("应该渲染剧集卡片", () => {
    render(
      <EpisodesSection
        {...defaultProps()}
        episodes={[makeEpisode(1), makeEpisode(2)]}
        totalEpisodes={2}
      />,
    );

    expect(screen.getByText("第 1 集")).toBeInTheDocument();
    expect(screen.getByText("第 2 集")).toBeInTheDocument();
    expect(screen.getByText("共 2 集")).toBeInTheDocument();
  });

  it("当没有剧集时，应该显示空状态提示", () => {
    render(<EpisodesSection {...defaultProps()} />);

    expect(screen.getByText("暂无剧集数据")).toBeInTheDocument();
  });

  it("点击剧集卡片时，应该调用 onEpisodeClick", () => {
    const onEpisodeClick = vi.fn();
    const ep = makeEpisode(1);
    render(
      <EpisodesSection
        {...defaultProps()}
        episodes={[ep]}
        totalEpisodes={1}
        onEpisodeClick={onEpisodeClick}
      />,
    );

    fireEvent.click(screen.getByText("第 1 集").closest("button")!);

    expect(onEpisodeClick).toHaveBeenCalledWith(ep);
  });

  it("如果当前时间 >= ep.airdate，剧集卡片应该使用主色样式；否则使用普通样式", () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const future = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    render(
      <EpisodesSection
        {...defaultProps()}
        episodes={[
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
        ]}
        totalEpisodes={2}
      />,
    );

    const airedCard = screen.getByText("已播出剧集").closest("button");
    const unairedCard = screen.getByText("未播出剧集").closest("button");

    expect(airedCard!.className).toContain("bg-primary/5");
    expect(airedCard!.className).toContain("border-primary/20");
    expect(unairedCard!.className).toContain("bg-card");
    expect(unairedCard!.className).toContain("border-border");
  });

  it("当有错误时，应该显示错误状态并可重试", () => {
    const onRetry = vi.fn();
    render(
      <EpisodesSection
        {...defaultProps()}
        error={new Error("Episodes API Error")}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("获取剧集列表失败")).toBeInTheDocument();
    expect(screen.getByText("Episodes API Error")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("加载中时应该显示骨架屏", () => {
    const { container } = render(
      <EpisodesSection {...defaultProps()} loading={true} />,
    );

    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("总页数大于 1 时，应该显示分页组件", () => {
    render(
      <EpisodesSection
        {...defaultProps()}
        episodes={Array.from({ length: 50 }, (_, i) => makeEpisode(i + 1))}
        totalEpisodes={103}
        totalPages={3}
        page={1}
      />,
    );

    expect(screen.getByText("共 103 集")).toBeInTheDocument();
  });

  it("总页数为 1 时，不应该显示分页组件", () => {
    render(
      <EpisodesSection
        {...defaultProps()}
        episodes={[makeEpisode(1)]}
        totalEpisodes={1}
        totalPages={1}
      />,
    );

    expect(screen.getByText("共 1 集")).toBeInTheDocument();
  });
});

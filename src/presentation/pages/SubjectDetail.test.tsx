import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { toast } from "sonner";
import { vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import type {
  BangumiEpisode,
  BangumiEpisodesPage,
  BangumiSubject,
} from "@/domain/bangumi/BangumiSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { resetAppStores } from "@/test/store-reset";
import { createDIContainerForTest } from "@/test/test-utils";
import { TorrentStatusProvider } from "../context/TorrentStatusContext";
import SubjectDetail from "./SubjectDetail";

const currentLocation = {
  current: null as { pathname: string; search: string } | null,
};
const LocationTracker = () => {
  currentLocation.current = useLocation();
  return null;
};
const TestLayout = () => (
  <>
    <LocationTracker />
    <Outlet />
  </>
);

type InitialEntry = string | { pathname: string; state?: unknown };

const renderSubjectRouter = (
  container: DIContainer,
  initialEntries: InitialEntry[],
  opts: { index?: number } = {},
) => {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <TestLayout />,
        children: [
          { path: "calendar", element: <div>日历页面</div> },
          { path: "subject", element: <SubjectDetail /> },
          { path: "subject/:subjectId", element: <SubjectDetail /> },
        ],
      },
    ],
    { initialEntries, initialIndex: opts.index },
  );
  return render(
    <DIProvider value={container}>
      <RouterProvider router={router} />
    </DIProvider>,
  );
};

describe("SubjectDetail 页面组件", () => {
  let mockContainer: DIContainer;

  let user: ReturnType<typeof userEvent.setup>;
  beforeEach(() => {
    currentLocation.current = null;
    user = userEvent.setup();
    resetAppStores();
    vi.clearAllMocks();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  const renderSubjectDetail = (
    mockSubjectPromise: Promise<BangumiSubject>,
    mockEpisodesPromise: Promise<BangumiEpisodesPage | BangumiEpisode[]>,
    openerRepository?: any,
  ) => {
    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockReturnValue(mockSubjectPromise),
        getEpisodes: vi.fn().mockImplementation(async () => {
          const data = await mockEpisodesPromise;
          return Array.isArray(data)
            ? { items: data, total: data.length }
            : data;
        }),
      },
      openerRepository,
    });

    return renderSubjectRouter(mockContainer, ["/subject/123"]);
  };

  it("当 API 正确返回数据时，应该展示动漫标题、信息、评分和剧集列表", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Test Anime Title",
      name_cn: "测试动漫标题",
      summary: "这是一个测试动漫的简介内容。",
      images: {
        large: "http://example.com/large.jpg",
        common: "http://example.com/common.jpg",
        medium: "http://example.com/medium.jpg",
        small: "http://example.com/small.jpg",
        grid: "http://example.com/grid.jpg",
      },
      rating: {
        score: 8.5,
        rank: 42,
        total: 1000,
      },
      collection: {
        wish: 100,
        collect: 500,
        doing: 200,
        on_hold: 50,
        dropped: 10,
      },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    const mockEpisodes: BangumiEpisode[] = [
      {
        id: 1002,
        type: 1,
        sort: 2,
        name: "Second Ep",
        name_cn: "第二集 中文",
        duration: "24:00",
        airdate: "2026-07-02",
        desc: "第二集的简介内容",
      },
      {
        id: 1001,
        type: 0,
        sort: 1,
        name: "First Episode Jp",
        name_cn: "第一集 中文",
        duration: "24:00",
        airdate: "2026-07-01",
        desc: "第一集的简介内容",
      },
      {
        id: 1003,
        type: 2,
        sort: 3,
        name: "Third Ep",
        name_cn: "第三集 中文",
        duration: "24:00",
        airdate: "2026-07-03",
        desc: "",
      },
      {
        id: 1004,
        type: 3,
        sort: 4,
        name: "Fourth Ep",
        name_cn: "第四集 中文",
        duration: "24:00",
        airdate: "2026-07-04",
        desc: "",
      },
      {
        id: 1005,
        type: 4,
        sort: 5,
        name: "Fifth Ep",
        name_cn: "第五集 中文",
        duration: "24:00",
        airdate: "2026-07-05",
        desc: "",
      },
      {
        id: 1006,
        type: 5,
        sort: 6,
        name: "Sixth Ep",
        name_cn: "第六集 中文",
        duration: "24:00",
        airdate: "2026-07-06",
        desc: "",
      },
    ];

    renderSubjectDetail(
      Promise.resolve(mockSubject),
      Promise.resolve(mockEpisodes),
    );

    await waitFor(() => {
      expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
    });

    expect(screen.getByText("Test Anime Title")).toBeInTheDocument();
    expect(
      screen.getByText("这是一个测试动漫的简介内容。"),
    ).toBeInTheDocument();
    expect(screen.getByText("8.5")).toBeInTheDocument();
    expect(screen.getByText("Rank #42")).toBeInTheDocument();
    expect(screen.getByText("第一集 中文")).toBeInTheDocument();
    expect(screen.getByText("第二集 中文")).toBeInTheDocument();
  });

  it("点击剧集卡片时，应该跳转到主页并携带该剧集的搜索词", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Test Anime Title",
      name_cn: "测试动漫标题",
      summary: "简介",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 1000 },
      collection: {
        wish: 100,
        collect: 500,
        doing: 200,
        on_hold: 50,
        dropped: 10,
      },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    const mockEpisodes: BangumiEpisode[] = [
      {
        id: 1001,
        type: 0,
        sort: 1,
        name: "First Episode Jp",
        name_cn: "第一集 中文",
        duration: "24:00",
        airdate: "2026-07-01",
        desc: "第一集简介",
      },
    ];

    renderSubjectDetail(
      Promise.resolve(mockSubject),
      Promise.resolve(mockEpisodes),
    );

    await waitFor(() => {
      expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
    });

    const episodeCard = screen.getByText("第一集 中文").closest("button");
    expect(episodeCard).toBeInTheDocument();
    fireEvent.click(episodeCard!);

    expect(currentLocation.current?.pathname).toBe("/");
    expect(currentLocation.current?.search).toBe(
      `?keyword=${encodeURIComponent("测试动漫标题 01")}`,
    );
  });

  it("当 API 请求失败时，应该显示错误提示", async () => {
    renderSubjectDetail(
      Promise.reject(new Error("Subject API Error")),
      Promise.resolve([]),
    );

    await waitFor(() => {
      expect(
        screen.getByText("获取动漫详情失败", { exact: false }),
      ).toBeInTheDocument();
    });
  });

  it("点击详情链接应该在浏览器中打开", async () => {
    const mockOpenUrl = vi.fn().mockResolvedValue(undefined);

    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Test Anime Title",
      name_cn: "测试动漫标题",
      summary: "简介",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 1000 },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    renderSubjectDetail(Promise.resolve(mockSubject), Promise.resolve([]), {
      openUrl: mockOpenUrl,
    });

    await waitFor(() => {
      expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
    });

    const detailLink = screen.getByRole("link", { name: "详情" });
    fireEvent.click(detailLink);

    await waitFor(() => {
      expect(mockOpenUrl).toHaveBeenCalledWith("https://bgm.tv/subject/123");
    });
  });

  it("如果当前时间 >= ep.airdate，剧集卡片应该使用主色样式；否则使用普通样式", async () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const future = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    const formatDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const yesterdayStr = formatDate(yesterday);
    const futureStr = formatDate(future);

    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Test Anime Title",
      name_cn: "测试动漫标题",
      summary: "简介",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 1000 },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    const mockEpisodes: BangumiEpisode[] = [
      {
        id: 1001,
        type: 0,
        sort: 1,
        name: "已播出剧集",
        name_cn: "已播出剧集",
        duration: "24:00",
        airdate: yesterdayStr,
        desc: "已播出",
      },
      {
        id: 1002,
        type: 0,
        sort: 2,
        name: "未播出剧集",
        name_cn: "未播出剧集",
        duration: "24:00",
        airdate: futureStr,
        desc: "未播出",
      },
    ];

    renderSubjectDetail(
      Promise.resolve(mockSubject),
      Promise.resolve(mockEpisodes),
    );

    await waitFor(() => {
      expect(screen.getByText("已播出剧集")).toBeInTheDocument();
    });

    const airedCard = screen.getByText("已播出剧集").closest("button");
    const unairedCard = screen.getByText("未播出剧集").closest("button");

    expect(airedCard).toBeInTheDocument();
    expect(unairedCard).toBeInTheDocument();

    expect(airedCard!.className).toContain("bg-primary/5");
    expect(airedCard!.className).toContain("border-primary/20");

    expect(unairedCard!.className).toContain("bg-card");
    expect(unairedCard!.className).toContain("border-border");
  });

  it("点击返回按钮时，应该返回上一页", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Test Anime Title",
      name_cn: "测试动漫标题",
      summary: "简介",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 1000 },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
        getEpisodes: vi
          .fn()
          .mockReturnValue(Promise.resolve({ items: [], total: 0 })),
      },
    });

    renderSubjectRouter(mockContainer, ["/calendar", "/subject/123"], {
      index: 1,
    });

    await waitFor(() => {
      expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
    });

    const backButton = screen.getByRole("button", { name: "返回" });
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(currentLocation.current?.pathname).toBe("/calendar");
    });
  });

  it("当 API 返回的字段缺失时，页面应该正常渲染且不报错", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Test Anime Title",
      name_cn: "",
      summary: null,
      images: null,
      rating: null,
      collection: null,
      date: null,
      eps: null,
      platform: null,
    };

    renderSubjectDetail(Promise.resolve(mockSubject), Promise.resolve([]));

    await waitFor(() => {
      expect(screen.getByText("Test Anime Title")).toBeInTheDocument();
    });
  });

  it("加载数据时应该显示正在加载动漫详情提示", async () => {
    let resolveSubject: (value: BangumiSubject) => void = () => {};
    const subjectPromise = new Promise<BangumiSubject>((resolve) => {
      resolveSubject = resolve;
    });

    renderSubjectDetail(subjectPromise, Promise.resolve([]));

    expect(screen.getByText("正在加载动漫详情...")).toBeInTheDocument();

    // Resolve to prevent open promises warnings
    await act(async () => {
      resolveSubject({
        id: 123,
        name: "Anime",
        name_cn: "",
        summary: null,
        images: null,
        rating: null,
        collection: null,
        date: null,
        eps: null,
        platform: null,
      });
    });
  });

  it("当点击返回且支持视图过渡时，应该调用 startViewTransition 并返回上一页", async () => {
    const startViewTransitionMock = vi.fn((cb) => cb());
    document.startViewTransition = startViewTransitionMock as any;

    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Test Anime Title",
      name_cn: "测试动漫标题",
      summary: "简介",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 1000 },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
        getEpisodes: vi
          .fn()
          .mockReturnValue(Promise.resolve({ items: [], total: 0 })),
      },
    });

    renderSubjectRouter(mockContainer, ["/calendar", "/subject/123"], {
      index: 1,
    });

    await waitFor(() => {
      expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
    });

    const backButton = screen.getByRole("button", { name: "返回" });
    fireEvent.click(backButton);

    expect(startViewTransitionMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(currentLocation.current?.pathname).toBe("/calendar");
    });

    delete (document as any).startViewTransition;
  });

  it("进入页面处于加载状态时，如果路由 state 中含有数据，应该展示传递的数据", async () => {
    let resolveSubject: (value: BangumiSubject) => void = () => {};
    const subjectPromise = new Promise<BangumiSubject>((resolve) => {
      resolveSubject = resolve;
    });

    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockReturnValue(subjectPromise),
        getEpisodes: vi
          .fn()
          .mockReturnValue(Promise.resolve({ items: [], total: 0 })),
      },
    });

    renderSubjectRouter(mockContainer, [
      {
        pathname: "/subject/123",
        state: {
          name: "传递的动画名称",
          imageUrl: "http://example.com/passed-cover.jpg",
        },
      },
    ]);

    // 应该立即展示 state 中的名称和图片
    expect(screen.getByText("传递的动画名称")).toBeInTheDocument();
    const img = screen.getByRole("img", { name: "传递的动画名称" });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe("http://example.com/passed-cover.jpg");
    expect(screen.getByText("正在加载动漫详情...")).toBeInTheDocument();

    // 解决 Promise 以避免警告
    await act(async () => {
      resolveSubject({
        id: 123,
        name: "Anime",
        name_cn: "",
        summary: null,
        images: null,
        rating: null,
        collection: null,
        date: null,
        eps: null,
        platform: null,
      });
    });
  });

  it("应该完整展示剧情简介且不显示展开/收起按钮", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Test Anime Title",
      name_cn: "测试动漫标题",
      summary: "这是一个很长很长的剧情简介，完整展示，不再折叠。",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 1000 },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
        getEpisodes: vi
          .fn()
          .mockReturnValue(Promise.resolve({ items: [], total: 0 })),
      },
    });

    renderSubjectRouter(mockContainer, ["/subject/123"]);

    // Wait for rendering
    await waitFor(() => {
      expect(
        screen.getByText(/这是一个很长很长的剧情简介/),
      ).toBeInTheDocument();
    });

    // No expand/collapse button
    expect(
      screen.queryByRole("button", { name: "展开" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "收起" }),
    ).not.toBeInTheDocument();
  });

  it("应该能在缺少部分字段（如 platform、rating.total、ep.name_cn、ep.airdate）时正常降级渲染", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Test Anime Title",
      name_cn: "测试动漫标题",
      summary: "这是一个测试动漫的简介内容。",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: {
        score: 8.5,
        rank: 42,
        total: undefined as any, // test line 276 total fallback to 0
      },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: undefined as any, // test line 218 missing platform
    };

    const mockEpisodes: BangumiEpisode[] = [
      {
        id: 1001,
        type: 0,
        sort: 1,
        name: "First Episode Jp Only",
        name_cn: undefined as any, // test line 442 fallback to ep.name
        duration: "24:00",
        airdate: undefined as any, // test line 407 airdate falsy
        desc: "第一集的简介内容",
      },
      {
        id: 1002,
        type: 0,
        sort: 2,
        name: "Future Episode",
        name_cn: "未来的一集",
        duration: "24:00",
        airdate: "2099-12-31", // test line 407 airdate in future
        desc: "第二集的简介内容",
      },
    ];

    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
        getEpisodes: vi.fn().mockReturnValue(
          Promise.resolve({
            items: mockEpisodes,
            total: mockEpisodes.length,
          }),
        ),
      },
    });

    renderSubjectRouter(mockContainer, ["/subject/123"]);

    await waitFor(() => {
      expect(screen.getByText("测试动漫标题")).toBeInTheDocument();
    });

    // 1. Check platform Badge is not present
    expect(screen.queryByText("TV")).not.toBeInTheDocument();

    // 2. Check rating total fallback to 0
    expect(screen.getByText("0 人评分")).toBeInTheDocument();

    // 3. Check ep.name fallback for First Episode
    expect(screen.getByText("First Episode Jp Only")).toBeInTheDocument();

    // 4. Check future and undefined airdate styles / rendered classes
    expect(screen.getByText("未来的一集")).toBeInTheDocument();
  });

  it("当路由中没有 subjectId 时，应该渲染参数错误提示", async () => {
    mockContainer = createDIContainerForTest({});

    renderSubjectRouter(mockContainer, ["/subject"]);

    expect(screen.getByText("无效的条目详情参数")).toBeInTheDocument();
    expect(screen.getByText("缺少条目 ID 参数")).toBeInTheDocument();
  });

  it("当 subjectId 不是数字时，应该渲染参数错误提示", async () => {
    mockContainer = createDIContainerForTest({});

    renderSubjectRouter(mockContainer, ["/subject/abc"]);

    expect(screen.getByText("无效的条目详情参数")).toBeInTheDocument();
    expect(screen.getByText("条目 ID 必须是数字")).toBeInTheDocument();
  });

  it("在 API 数据加载成功前卸载组件，应该取消请求并不设置组件状态", async () => {
    let resolveSubject: any;
    const subjectPromise = new Promise<any>((resolve) => {
      resolveSubject = resolve;
    });

    let resolveEpisodes: any;
    const episodesPromise = new Promise<any>((resolve) => {
      resolveEpisodes = resolve;
    });

    const { unmount } = renderSubjectDetail(subjectPromise, episodesPromise);

    unmount();

    await act(async () => {
      resolveSubject({ id: 123, name: "Test" });
      resolveEpisodes([]);
    });
  });

  it("在 API 数据加载失败前卸载组件，应该取消请求并不设置错误信息", async () => {
    let rejectSubject: any;
    const subjectPromise = new Promise<any>((_, reject) => {
      rejectSubject = reject;
    });

    const episodesPromise = Promise.resolve([]);

    const { unmount } = renderSubjectDetail(subjectPromise, episodesPromise);

    unmount();

    await act(async () => {
      rejectSubject(new Error("Network Error"));
    });
  });

  it("当动漫和剧集均无中文名称时，点击剧集卡片应该使用原名进行搜索", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Original Anime Name",
      name_cn: "",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 100 },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    const mockEpisodes: BangumiEpisode[] = [
      {
        id: 1001,
        type: 0,
        sort: 1,
        name: "Original Ep Name",
        name_cn: "",
        duration: "24:00",
        airdate: "2026-07-01",
        desc: "第一集的简介内容",
      },
    ];

    renderSubjectDetail(
      Promise.resolve(mockSubject),
      Promise.resolve(mockEpisodes),
    );

    await waitFor(() => {
      expect(screen.getByText("Original Anime Name")).toBeInTheDocument();
    });

    const episodeCard = screen.getByText("Original Ep Name").closest("button");
    expect(episodeCard).toBeInTheDocument();
    fireEvent.click(episodeCard!);

    expect(currentLocation.current?.pathname).toBe("/");
    expect(currentLocation.current?.search).toBe(
      `?keyword=${encodeURIComponent("Original Anime Name 01")}`,
    );
  });

  it("剧集接口失败时应该显示错误组件，点击重试后重新发起请求", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Retry Anime",
      name_cn: "重试动漫",
      summary: "简介",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 100 },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    const getEpisodes = vi
      .fn()
      .mockRejectedValueOnce(new Error("Episodes API Error"))
      .mockResolvedValueOnce({ items: [], total: 0 });

    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockResolvedValue(mockSubject),
        getEpisodes,
      },
    });

    renderSubjectRouter(mockContainer, ["/subject/123"]);

    await waitFor(() => {
      expect(screen.getByText("获取剧集列表失败")).toBeInTheDocument();
    });
    expect(screen.getByText("Episodes API Error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    await waitFor(() => {
      expect(getEpisodes).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText("暂无剧集数据")).toBeInTheDocument();
    });
  });

  it("主体详情接口失败时，点击重试后应该重新发起请求", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Retry Anime",
      name_cn: "重试动漫",
      summary: "简介",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 100 },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    const getSubject = vi
      .fn()
      .mockRejectedValueOnce(new Error("Subject Fatal Error"))
      .mockResolvedValueOnce(mockSubject);

    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject,
        getEpisodes: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      },
    });

    renderSubjectRouter(mockContainer, ["/subject/123"]);

    await waitFor(() => {
      expect(
        screen.getByText("获取动漫详情失败", { exact: false }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Subject Fatal Error")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    await waitFor(() => {
      expect(getSubject).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText("重试动漫")).toBeInTheDocument();
    });
  });

  it("角色接口失败时应该显示错误组件", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Retry Anime",
      name_cn: "重试动漫",
      summary: "简介",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 100 },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockResolvedValue(mockSubject),
        getEpisodes: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        getSubjectCharacters: vi
          .fn()
          .mockRejectedValue(new Error("Characters API Error")),
        getSubjectPersons: vi.fn().mockResolvedValue([]),
      },
    });

    renderSubjectRouter(mockContainer, ["/subject/123"]);

    await user.click(screen.getByRole("tab", { name: /角色/ }));

    await waitFor(() => {
      expect(screen.getByText("获取角色数据失败")).toBeInTheDocument();
    });
    expect(screen.getByText("Characters API Error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });
});

describe("SubjectDetail 页面 - 角色和制作人员", () => {
  let mockContainer: DIContainer;

  let user: ReturnType<typeof userEvent.setup>;
  beforeEach(() => {
    resetAppStores();
    user = userEvent.setup();
    vi.clearAllMocks();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("数据加载完成后应该展示角色卡片区域", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Test Anime",
      name_cn: "测试动漫",
      summary: "简介",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 100 },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    const mockCharacters = [
      {
        images: {
          small: "https://example.com/small.jpg",
          grid: "https://example.com/grid.jpg",
          large: "https://example.com/large.jpg",
          medium: "https://example.com/medium.jpg",
        },
        name: "ヤニねこ",
        summary: "主角猫",
        relation: "主角",
        type: 1,
        id: 174916,
        actors: [
          {
            images: {
              small: "https://example.com/small.jpg",
              grid: "https://example.com/grid.jpg",
              large: "https://example.com/large.jpg",
              medium: "https://example.com/medium.jpg",
            },
            name: "夏吉ゆうこ",
            short_summary: "声优",
            career: ["seiyu"],
            id: 36024,
            type: 1,
            locked: false,
          },
        ],
      },
    ];

    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
        getEpisodes: vi
          .fn()
          .mockReturnValue(Promise.resolve({ items: [], total: 0 })),
        getSubjectCharacters: vi
          .fn()
          .mockReturnValue(Promise.resolve(mockCharacters)),
        getSubjectPersons: vi.fn().mockReturnValue(Promise.resolve([])),
      },
    });

    renderSubjectRouter(mockContainer, ["/subject/123"]);

    await waitFor(() => {
      expect(screen.getByText("测试动漫")).toBeInTheDocument();
    });

    // Characters section should be rendered
    await user.click(screen.getByRole("tab", { name: /角色/ }));
    expect(screen.getByText("ヤニねこ")).toBeInTheDocument();
    expect(screen.getByText("CV: 夏吉ゆうこ")).toBeInTheDocument();
  });

  it("数据加载完成后应该展示制作人员区域", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Test Anime",
      name_cn: "测试动漫",
      summary: "简介",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 100 },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    const mockPersons = [
      {
        images: {
          small: "https://example.com/small.jpg",
          grid: "https://example.com/grid.jpg",
          large: "https://example.com/large.jpg",
          medium: "https://example.com/medium.jpg",
        },
        name: "木村拓",
        relation: "导演",
        career: ["producer"],
        type: 1,
        id: 44615,
        eps: "",
      },
      {
        images: {
          small: "",
          grid: "",
          large: "",
          medium: "",
        },
        name: "あおしまたかし",
        relation: "脚本",
        career: ["producer"],
        type: 1,
        id: 2639,
        eps: "3",
      },
    ];

    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
        getEpisodes: vi
          .fn()
          .mockReturnValue(Promise.resolve({ items: [], total: 0 })),
        getSubjectCharacters: vi.fn().mockReturnValue(Promise.resolve([])),
        getSubjectPersons: vi
          .fn()
          .mockReturnValue(Promise.resolve(mockPersons)),
      },
    });

    renderSubjectRouter(mockContainer, ["/subject/123"]);

    await waitFor(() => {
      expect(screen.getByText("测试动漫")).toBeInTheDocument();
    });

    // Switch to staff tab
    await user.click(screen.getByRole("tab", { name: /制作人员/ }));

    // Staff section should be rendered
    expect(screen.getByText("木村拓")).toBeInTheDocument();
    expect(screen.getByText("あおしまたかし")).toBeInTheDocument();
    // Relation header should be visible
    expect(screen.getByText("导演")).toBeInTheDocument();
    expect(screen.getByText("脚本")).toBeInTheDocument();
  });

  it("角色区域数据为空时应该展示空状态提示", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Test Anime",
      name_cn: "测试动漫",
      summary: "简介",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 100 },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
        getEpisodes: vi
          .fn()
          .mockReturnValue(Promise.resolve({ items: [], total: 0 })),
        getSubjectCharacters: vi.fn().mockReturnValue(Promise.resolve([])),
        getSubjectPersons: vi.fn().mockReturnValue(Promise.resolve([])),
      },
    });

    renderSubjectRouter(mockContainer, ["/subject/123"]);

    await waitFor(() => {
      expect(screen.getByText("测试动漫")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /角色/ }));
    expect(screen.getByText("暂无角色数据")).toBeInTheDocument();

    // Switch to staff tab to check staff empty state
    await user.click(screen.getByRole("tab", { name: /制作人员/ }));
    expect(screen.getByText("暂无制作人员数据")).toBeInTheDocument();
  });

  it("在角色和制作人员数据加载中时应该显示骨架屏", async () => {
    let resolveSubject: (value: BangumiSubject) => void = () => {};
    const subjectPromise = new Promise<BangumiSubject>((resolve) => {
      resolveSubject = resolve;
    });

    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockReturnValue(subjectPromise),
        getEpisodes: vi.fn().mockReturnValue(new Promise(() => {})),
        getSubjectCharacters: vi.fn().mockReturnValue(new Promise(() => {})),
        getSubjectPersons: vi.fn().mockReturnValue(new Promise(() => {})),
      },
    });

    renderSubjectRouter(mockContainer, ["/subject/123"]);

    // The sections should exist with skeleton loading indicators
    expect(screen.getByText("角色")).toBeInTheDocument();
    expect(screen.getByText("制作人员")).toBeInTheDocument();

    // Switch to characters tab to verify characters skeleton exists
    await user.click(screen.getByRole("tab", { name: /角色/ }));
    expect(screen.getByTestId("characters-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("staff-skeleton")).not.toBeInTheDocument();

    // Switch to staff tab to verify staff skeleton exists
    await user.click(screen.getByRole("tab", { name: /制作人员/ }));
    expect(screen.getByTestId("staff-skeleton")).toBeInTheDocument();

    // Resolve to clean up
    await act(async () => {
      resolveSubject({
        id: 123,
        name: "Anime",
        name_cn: "",
        summary: null,
        images: null,
        rating: null,
        collection: null,
        date: null,
        eps: null,
        platform: null,
      });
    });
  });

  it("同一个人相同制作角色出现多次时应正确去重", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Test Anime",
      name_cn: "测试动漫",
      summary: "简介",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 100 },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    const mockPersons = [
      {
        images: { small: "", grid: "", large: "", medium: "" },
        name: "木村拓",
        relation: "导演",
        career: ["producer"],
        type: 1,
        id: 44615,
        eps: "",
      },
      {
        images: { small: "", grid: "", large: "", medium: "" },
        name: "木村拓",
        relation: "导演",
        career: ["producer"],
        type: 1,
        id: 44615,
        eps: "",
      },
      {
        images: { small: "", grid: "", large: "", medium: "" },
        name: "木村拓",
        relation: "脚本",
        career: ["producer"],
        type: 1,
        id: 44615,
        eps: "1-3",
      },
    ];

    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
        getEpisodes: vi
          .fn()
          .mockReturnValue(Promise.resolve({ items: [], total: 0 })),
        getSubjectCharacters: vi.fn().mockReturnValue(Promise.resolve([])),
        getSubjectPersons: vi
          .fn()
          .mockReturnValue(Promise.resolve(mockPersons)),
      },
    });

    renderSubjectRouter(mockContainer, ["/subject/123"]);

    await waitFor(() => {
      expect(screen.getByText("测试动漫")).toBeInTheDocument();
    });

    // Switch to staff tab
    await user.click(screen.getByRole("tab", { name: /制作人员/ }));

    expect(screen.getByText("导演")).toBeInTheDocument();
    expect(screen.getByText("脚本")).toBeInTheDocument();
  });

  it("角色使用 medium 图片降级且有多名声优时应该正常显示", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Test Anime",
      name_cn: "测试动漫",
      summary: "简介",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 100 },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    const mockCharacters = [
      {
        images: {
          small: "",
          grid: "",
          large: "",
          medium: "http://example.com/medium.jpg",
        },
        name: "ヤニねこ",
        summary: "主角猫",
        relation: "配角",
        type: 1,
        id: 174916,
        actors: [
          {
            images: { small: "", grid: "", large: "", medium: "" },
            name: "声優A",
            short_summary: "",
            career: ["seiyu"],
            id: 1,
            type: 1,
            locked: false,
          },
          {
            images: { small: "", grid: "", large: "", medium: "" },
            name: "声優B",
            short_summary: "",
            career: ["seiyu"],
            id: 2,
            type: 1,
            locked: false,
          },
        ],
      },
    ];

    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
        getEpisodes: vi
          .fn()
          .mockReturnValue(Promise.resolve({ items: [], total: 0 })),
        getSubjectCharacters: vi
          .fn()
          .mockReturnValue(Promise.resolve(mockCharacters)),
        getSubjectPersons: vi.fn().mockReturnValue(Promise.resolve([])),
      },
    });

    renderSubjectRouter(mockContainer, ["/subject/123"]);

    await waitFor(() => {
      expect(screen.getByText("测试动漫")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /角色/ }));
    expect(screen.getByText("+1 位声优")).toBeInTheDocument();
    expect(screen.getByText("CV: 声優A")).toBeInTheDocument();
  });

  it("角色图片完全为空时应正常显示占位符", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Test Anime",
      name_cn: "测试动漫",
      summary: "简介",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 100 },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    const mockCharacters = [
      {
        images: { small: "", grid: "", large: "", medium: "" },
        name: "ノーイメージ",
        summary: "",
        relation: "配角",
        type: 1,
        id: 99991,
        actors: [],
      },
    ];

    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockReturnValue(Promise.resolve(mockSubject)),
        getEpisodes: vi
          .fn()
          .mockReturnValue(Promise.resolve({ items: [], total: 0 })),
        getSubjectCharacters: vi
          .fn()
          .mockReturnValue(Promise.resolve(mockCharacters)),
        getSubjectPersons: vi.fn().mockReturnValue(Promise.resolve([])),
      },
    });

    renderSubjectRouter(mockContainer, ["/subject/123"]);

    await waitFor(() => {
      expect(screen.getByText("测试动漫")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /角色/ }));
    expect(screen.getByText("ノーイメージ")).toBeInTheDocument();
  });

  it("制作人员接口失败时应该显示错误组件", async () => {
    const mockSubject: BangumiSubject = {
      id: 123,
      name: "Test Anime",
      name_cn: "测试动漫",
      summary: "简介",
      images: {
        large: "http://example.com/large.jpg",
        common: "",
        medium: "",
        small: "",
        grid: "",
      },
      rating: { score: 8.5, rank: 42, total: 100 },
      collection: { doing: 200 },
      date: "2026-07-01",
      eps: 12,
      platform: "TV",
    };

    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockResolvedValue(mockSubject),
        getEpisodes: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        getSubjectCharacters: vi.fn().mockResolvedValue([]),
        getSubjectPersons: vi
          .fn()
          .mockRejectedValue(new Error("Persons API Error")),
      },
    });

    renderSubjectRouter(mockContainer, ["/subject/123"]);

    await waitFor(() => {
      expect(screen.getByText("测试动漫")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /制作人员/ }));

    await waitFor(() => {
      expect(screen.getByText("获取制作人员数据失败")).toBeInTheDocument();
    });
    expect(screen.getByText("Persons API Error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });
});

describe("SubjectDetail 页面 - 剧集分页", () => {
  let mockContainer: DIContainer;
  let user: ReturnType<typeof userEvent.setup>;

  const makeSubject = (): BangumiSubject => ({
    id: 123,
    name: "Test Anime",
    name_cn: "分页测试动漫",
    summary: "简介",
    images: {
      large: "http://example.com/large.jpg",
      common: "",
      medium: "",
      small: "",
      grid: "",
    },
    rating: { score: 8.5, rank: 42, total: 100 },
    collection: { doing: 200 },
    date: "2026-07-01",
    eps: 103,
    platform: "TV",
  });

  const makeEpisode = (sort: number): BangumiEpisode => ({
    id: 1000 + sort,
    type: 0,
    sort,
    name: `Episode ${sort}`,
    name_cn: `第 ${sort} 集`,
    duration: "24:00",
    airdate: "2026-07-01",
    desc: "",
  });

  const renderPagedSubject = (
    initialEntries: string[],
    getEpisodes: (
      ctx: unknown,
      subjectId: string,
      offset: number,
      limit: number,
    ) => Promise<BangumiEpisodesPage>,
  ) => {
    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockResolvedValue(makeSubject()),
        getEpisodes,
      },
    });

    return renderSubjectRouter(mockContainer, initialEntries);
  };

  beforeEach(() => {
    currentLocation.current = null;
    user = userEvent.setup();
    resetAppStores();
    vi.clearAllMocks();
    vi.spyOn(window, "open").mockImplementation(() => null);
    vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
  });

  it("当总集数超过每页数量时，应该显示分页栏并以 offset=0 请求第一页", async () => {
    const getEpisodes = vi
      .fn()
      .mockImplementation(async (_ctx, _id, offset) => {
        if (offset === 0) {
          return {
            items: Array.from({ length: 50 }, (_, i) => makeEpisode(i + 1)),
            total: 103,
          };
        }
        return { items: [], total: 103 };
      });

    renderPagedSubject(["/subject/123"], getEpisodes);

    await waitFor(() => {
      expect(screen.getByText("分页测试动漫")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("共 103 集 · 第 1 / 3 页")).toBeInTheDocument();
    });
    expect(screen.getByText("第 1 集")).toBeInTheDocument();
    expect(screen.getByText("第 50 集")).toBeInTheDocument();
    expect(getEpisodes).toHaveBeenCalledWith(expect.anything(), "123", 0, 50);
  });

  it("点击页码按钮时，应该以对应 offset 重新请求并渲染该页剧集", async () => {
    const getEpisodes = vi
      .fn()
      .mockImplementation(async (_ctx, _id, offset) => {
        if (offset === 0) {
          return {
            items: Array.from({ length: 50 }, (_, i) => makeEpisode(i + 1)),
            total: 103,
          };
        }
        return {
          items: [makeEpisode(51), makeEpisode(52)],
          total: 103,
        };
      });

    renderPagedSubject(["/subject/123"], getEpisodes);

    await waitFor(() => {
      expect(screen.getByText("第 1 集")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "2" }));

    await waitFor(() => {
      expect(getEpisodes).toHaveBeenCalledWith(
        expect.anything(),
        "123",
        50,
        50,
      );
    });
    await waitFor(() => {
      expect(screen.getByText("第 51 集")).toBeInTheDocument();
    });
    expect(screen.getByText("共 103 集 · 第 2 / 3 页")).toBeInTheDocument();
  });

  it("在页码跳转输入框输入页码并按回车，应该跳转到指定页", async () => {
    const getEpisodes = vi
      .fn()
      .mockImplementation(async (_ctx, _id, offset) => {
        if (offset === 100) {
          return {
            items: [makeEpisode(101), makeEpisode(102)],
            total: 103,
          };
        }
        return {
          items: Array.from({ length: 50 }, (_, i) => makeEpisode(i + 1)),
          total: 103,
        };
      });

    renderPagedSubject(["/subject/123"], getEpisodes);

    await waitFor(() => {
      expect(screen.getByText("第 1 集")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("跳转页码"), "3{enter}");

    await waitFor(() => {
      expect(getEpisodes).toHaveBeenCalledWith(
        expect.anything(),
        "123",
        100,
        50,
      );
    });
    await waitFor(() => {
      expect(screen.getByText("第 101 集")).toBeInTheDocument();
    });
    expect(screen.getByText("共 103 集 · 第 3 / 3 页")).toBeInTheDocument();
  });

  it("输入集数跳转时，应该跳到对应页并滚动定位到该集", async () => {
    const getEpisodes = vi
      .fn()
      .mockImplementation(async (_ctx, _id, offset) => {
        if (offset === 100) {
          return {
            items: [makeEpisode(101), makeEpisode(102), makeEpisode(123)],
            total: 103,
          };
        }
        return {
          items: Array.from({ length: 50 }, (_, i) => makeEpisode(i + 1)),
          total: 103,
        };
      });

    renderPagedSubject(["/subject/123"], getEpisodes);

    await waitFor(() => {
      expect(screen.getByText("第 1 集")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("跳转集数"), "123{enter}");

    await waitFor(() => {
      expect(getEpisodes).toHaveBeenCalledWith(
        expect.anything(),
        "123",
        100,
        50,
      );
    });
    await waitFor(() => {
      expect(screen.getByText("第 123 集")).toBeInTheDocument();
    });

    const episodeCard = screen.getByText("第 123 集").closest("button");
    expect(episodeCard?.dataset.episodeSort).toBe("123");
  });

  it("总集数不超过每页数量时，不应该显示分页栏", async () => {
    const getEpisodes = vi.fn().mockResolvedValue({
      items: [makeEpisode(1), makeEpisode(2)],
      total: 2,
    });

    renderPagedSubject(["/subject/123"], getEpisodes);

    await waitFor(() => {
      expect(screen.getByText("第 1 集")).toBeInTheDocument();
    });

    expect(screen.getByText("共 2 集")).toBeInTheDocument();
    expect(screen.queryByText("跳转页")).not.toBeInTheDocument();
    expect(screen.queryByText("跳转集")).not.toBeInTheDocument();
  });

  it("当 page 查询参数超出总页数时，应该自动归一化到最后有效页", async () => {
    const getEpisodes = vi
      .fn()
      .mockImplementation(async (_ctx, _id, offset) => {
        if (offset === 100) {
          return {
            items: [makeEpisode(101), makeEpisode(102)],
            total: 103,
          };
        }
        return { items: [], total: 103 };
      });

    renderPagedSubject(["/subject/123?page=99"], getEpisodes);

    await waitFor(() => {
      expect(screen.getByText("共 103 集 · 第 3 / 3 页")).toBeInTheDocument();
    });
    expect(currentLocation.current?.search).toContain("page=3");
  });

  it("当 page 查询参数非法时，应该渲染参数错误提示", async () => {
    mockContainer = createDIContainerForTest({});

    renderSubjectRouter(mockContainer, ["/subject/123?page=abc"]);

    expect(screen.getByText("无效的条目详情参数")).toBeInTheDocument();
    expect(screen.getByText("页码必须是数字")).toBeInTheDocument();
  });
});

describe("SubjectDetail 页面 - 资源绑定", () => {
  let mockContainer: DIContainer;
  let user: ReturnType<typeof userEvent.setup>;

  const makeSubject = (): BangumiSubject => ({
    id: 123,
    name: "Test Anime",
    name_cn: "测试动漫",
    summary: "简介",
    images: {
      large: "http://example.com/large.jpg",
      common: "",
      medium: "",
      small: "",
      grid: "",
    },
    rating: { score: 8.5, rank: 42, total: 100 },
    collection: { doing: 200 },
    date: "2026-07-01",
    eps: 12,
    platform: "TV",
  });

  const makeTorrent = (
    overrides: Partial<TorrentStatusInfo>,
  ): TorrentStatusInfo => ({
    info_hash: NonEmptyStringSchema.parse("hash-1"),
    name: NonEmptyStringSchema.parse("测试种子"),
    progress_bytes: 100,
    total_bytes: 100,
    finished: false,
    download_speed_bytes_per_sec: 0,
    upload_speed_bytes_per_sec: 0,
    paused: false,
    peers_connected: 0,
    peers_total: 0,
    trackers: [],
    ...overrides,
  });

  const renderResourceTab = (
    torrents: TorrentStatusInfo[],
    hooks?: {
      setTorrentSubject?: (
        infoHash: string,
        subject_id: number,
        subject_name: string,
      ) => Promise<void>;
      clearTorrentSubject?: (infoHash: string) => Promise<void>;
    },
  ) => {
    mockContainer = createDIContainerForTest({
      bangumiRepository: {
        getCalendar: vi.fn().mockResolvedValue([]),
        getSubject: vi.fn().mockResolvedValue(makeSubject()),
        getEpisodes: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      },
      torrentRepository: {
        subscribeTorrents: vi.fn().mockImplementation(async (onUpdate) => {
          onUpdate(torrents);
          return () => {};
        }),
        setTorrentSubject: hooks?.setTorrentSubject ?? vi.fn(),
        clearTorrentSubject: hooks?.clearTorrentSubject ?? vi.fn(),
      },
    });

    return render(
      <DIProvider value={mockContainer}>
        <TorrentStatusProvider>
          <RouterProvider
            router={createMemoryRouter(
              [
                {
                  path: "/",
                  element: <TestLayout />,
                  children: [
                    { path: "subject/:subjectId", element: <SubjectDetail /> },
                    { path: "torrent", element: <div>种子详情页</div> },
                  ],
                },
              ],
              { initialEntries: ["/subject/123"] },
            )}
          />
        </TorrentStatusProvider>
      </DIProvider>,
    );
  };

  beforeEach(() => {
    currentLocation.current = null;
    user = userEvent.setup();
    resetAppStores();
    vi.clearAllMocks();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("当没有绑定任务时，资源标签页应该展示空状态", async () => {
    renderResourceTab([]);

    await waitFor(() => {
      expect(screen.getByText("测试动漫")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /资源/ }));

    expect(screen.getByText("暂未绑定下载资源")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /绑定下载/ }),
    ).toBeInTheDocument();
  });

  it("资源标签页应该展示已绑定任务，并在标签上显示数量徽章", async () => {
    renderResourceTab([
      makeTorrent({
        subject_id: 123,
        subject_name: NonEmptyStringSchema.parse("测试动漫"),
      }),
      makeTorrent({
        info_hash: NonEmptyStringSchema.parse("hash-2"),
        name: NonEmptyStringSchema.parse("未绑定种子"),
      }),
    ]);

    await waitFor(() => {
      expect(screen.getByText("测试动漫")).toBeInTheDocument();
    });

    const resourceTab = screen.getByRole("tab", { name: /资源/ });
    expect(resourceTab).toHaveTextContent("1");

    await user.click(resourceTab);

    expect(screen.getByText("测试种子")).toBeInTheDocument();
    expect(screen.queryByText("未绑定种子")).not.toBeInTheDocument();
  });

  it("点击已绑定任务行，应该跳转到种子详情页并携带 hash 与标题", async () => {
    renderResourceTab([
      makeTorrent({
        info_hash: NonEmptyStringSchema.parse("hash-1"),
        name: NonEmptyStringSchema.parse("测试种子"),
        subject_id: 123,
        subject_name: NonEmptyStringSchema.parse("测试动漫"),
      }),
    ]);

    await waitFor(() => {
      expect(screen.getByText("测试动漫")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /资源/ }));

    const row = screen.getByTestId("bound-torrent-row");
    await user.click(row);

    expect(currentLocation.current?.pathname).toBe("/torrent");
    expect(currentLocation.current?.search).toContain("infoHash=hash-1");
    expect(currentLocation.current?.search).toContain(
      `title=${encodeURIComponent("测试种子")}`,
    );
  });

  it("点击解绑按钮，应该调用 clearTorrentSubject", async () => {
    const clearTorrentSubject = vi.fn().mockResolvedValue(undefined);
    renderResourceTab(
      [
        makeTorrent({
          info_hash: NonEmptyStringSchema.parse("hash-1"),
          name: NonEmptyStringSchema.parse("测试种子"),
          subject_id: 123,
          subject_name: NonEmptyStringSchema.parse("测试动漫"),
        }),
      ],
      { clearTorrentSubject },
    );

    await waitFor(() => {
      expect(screen.getByText("测试动漫")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /资源/ }));

    await user.click(screen.getByRole("button", { name: /解绑/ }));

    await waitFor(() => {
      expect(clearTorrentSubject).toHaveBeenCalledWith("hash-1");
    });
  });

  it("打开绑定对话框，点击绑定应该调用 setTorrentSubject", async () => {
    const setTorrentSubject = vi.fn().mockResolvedValue(undefined);
    renderResourceTab(
      [
        makeTorrent({
          info_hash: NonEmptyStringSchema.parse("hash-1"),
          name: NonEmptyStringSchema.parse("测试种子"),
        }),
        makeTorrent({
          info_hash: NonEmptyStringSchema.parse("hash-2"),
          name: NonEmptyStringSchema.parse("另一个种子"),
          subject_id: 456,
          subject_name: NonEmptyStringSchema.parse("其他动漫"),
        }),
      ],
      { setTorrentSubject },
    );

    await waitFor(() => {
      expect(screen.getByText("测试动漫")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /资源/ }));

    await user.click(screen.getByRole("button", { name: /绑定下载/ }));

    // 对话框中应该列出所有下载，且已绑定到其它条目的显示为"改绑"
    expect(screen.getByText("绑定下载资源")).toBeInTheDocument();
    expect(screen.getByText("测试种子")).toBeInTheDocument();
    expect(screen.queryByText("另一个种子")).not.toBeInTheDocument();
    expect(screen.queryByText("已属于《其他动漫》")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "绑定" }));

    await waitFor(() => {
      expect(setTorrentSubject).toHaveBeenCalledWith("hash-1", 123, "测试动漫");
    });
  });

  it("绑定下载资源失败时，应该显示绑定失败提示", async () => {
    const setTorrentSubject = vi
      .fn()
      .mockRejectedValue(new Error("Bind failed"));
    renderResourceTab(
      [
        makeTorrent({
          info_hash: NonEmptyStringSchema.parse("hash-1"),
          name: NonEmptyStringSchema.parse("测试种子"),
        }),
      ],
      { setTorrentSubject },
    );

    await waitFor(() => {
      expect(screen.getByText("测试动漫")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /资源/ }));
    await user.click(screen.getByRole("button", { name: /绑定下载/ }));
    await user.click(screen.getByRole("button", { name: "绑定" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("绑定失败: Bind failed"),
      );
    });
  });

  it("解除绑定失败时，应该显示解绑失败提示", async () => {
    const clearTorrentSubject = vi
      .fn()
      .mockRejectedValue(new Error("Unbind failed"));
    renderResourceTab(
      [
        makeTorrent({
          info_hash: NonEmptyStringSchema.parse("hash-1"),
          name: NonEmptyStringSchema.parse("测试种子"),
          subject_id: 123,
          subject_name: NonEmptyStringSchema.parse("测试动漫"),
        }),
      ],
      { clearTorrentSubject },
    );

    await waitFor(() => {
      expect(screen.getByText("测试动漫")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /资源/ }));
    await user.click(screen.getByRole("button", { name: /解绑/ }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("解绑失败: Unbind failed"),
      );
    });
  });
});

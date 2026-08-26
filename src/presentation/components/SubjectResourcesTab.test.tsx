import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { vi } from "vitest";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { SubjectResourcesTab } from "@/presentation/components/SubjectResourcesTab";

const currentLocation = {
  current: null as { pathname: string; search: string } | null,
};
const LocationTracker = () => {
  const loc = useLocation();
  currentLocation.current = { pathname: loc.pathname, search: loc.search };
  return null;
};

const makeTorrent = (
  overrides: Partial<TorrentStatusInfo> = {},
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

const defaultProps = () => ({
  subjectName: "测试动漫标题",
  boundTorrents: [] as TorrentStatusInfo[],
  unboundTorrents: [] as TorrentStatusInfo[],
  bindLoading: false,
  unbindLoading: false,
  onBind: vi.fn(),
  onUnbind: vi.fn() as (infoHash: NonEmptyString) => void,
});

/** SubjectResourcesTab uses Link, so we need a router wrapper */
const renderWithRouter = (props: ReturnType<typeof defaultProps>) => {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <>
            <LocationTracker />
            <Outlet />
          </>
        ),
        children: [
          {
            path: "subject/:subjectId",
            element: <SubjectResourcesTab {...props} />,
          },
          { path: "torrent", element: <div>种子详情页</div> },
        ],
      },
    ],
    { initialEntries: ["/subject/123"] },
  );
  return render(<RouterProvider router={router} />);
};

describe("SubjectResourcesTab 资源标签页组件", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    currentLocation.current = null;
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  it("当没有绑定任务时，应该展示空状态", () => {
    renderWithRouter(defaultProps());

    expect(screen.getByText("暂未绑定下载资源")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /绑定下载/ }),
    ).toBeInTheDocument();
  });

  it("应该展示已绑定任务列表", () => {
    renderWithRouter({
      ...defaultProps(),
      boundTorrents: [makeTorrent()],
    });

    expect(screen.getByText("测试种子")).toBeInTheDocument();
  });

  it("点击已绑定任务行，应该跳转到种子详情页并携带 hash 与标题", async () => {
    renderWithRouter({
      ...defaultProps(),
      boundTorrents: [makeTorrent()],
    });

    await user.click(screen.getByTestId("bound-torrent-row"));

    expect(currentLocation.current?.pathname).toBe("/torrent");
    expect(currentLocation.current?.search).toContain("infoHash=hash-1");
    expect(currentLocation.current?.search).toContain(
      `title=${encodeURIComponent("测试种子")}`,
    );
  });

  it("点击解绑按钮，应该调用 onUnbind", async () => {
    const onUnbind = vi.fn();
    renderWithRouter({
      ...defaultProps(),
      boundTorrents: [makeTorrent()],
      onUnbind,
    });

    await user.click(screen.getByRole("button", { name: /解绑/ }));

    expect(onUnbind).toHaveBeenCalledWith(NonEmptyStringSchema.parse("hash-1"));
  });

  it("打开绑定对话框，应该展示未绑定任务列表", async () => {
    renderWithRouter({
      ...defaultProps(),
      unboundTorrents: [makeTorrent()],
    });

    await user.click(screen.getByRole("button", { name: /绑定下载/ }));

    expect(screen.getByText("绑定下载资源")).toBeInTheDocument();
    expect(screen.getByText("测试种子")).toBeInTheDocument();
  });

  it("在绑定对话框中点击绑定按钮，应该调用 onBind", async () => {
    const onBind = vi.fn();
    renderWithRouter({
      ...defaultProps(),
      unboundTorrents: [makeTorrent()],
      onBind,
    });

    await user.click(screen.getByRole("button", { name: /绑定下载/ }));
    await user.click(screen.getByRole("button", { name: "绑定" }));

    expect(onBind).toHaveBeenCalledWith("hash-1");
  });

  it("当 unboundTorrents 为空时，绑定对话框应该显示空状态", async () => {
    renderWithRouter(defaultProps());

    await user.click(screen.getByRole("button", { name: /绑定下载/ }));

    expect(screen.getByText("暂无下载任务")).toBeInTheDocument();
  });
});

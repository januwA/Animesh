import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import type { ResolveTorrentUseCase } from "@/application/torrent/ResolveTorrentUseCase";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "@/domain/torrent/TorrentRepository";
import type { AddTorrentResult } from "@/domain/torrent/TorrentSchemas";
import { resetAppStores } from "@/test/store-reset";
import { createDIContainerForTest } from "@/test/test-utils";
import { NavBarLayout } from "../components/Layout";
import TorrentDetail from "./TorrentDetail";

const currentLocation = {
  current: null as { pathname: string; search: string } | null,
};
const LocationTracker = () => {
  currentLocation.current = useLocation();
  return null;
};
const getCurrentLocation = () => currentLocation.current;

describe("TorrentDetail 页面组件", () => {
  let mockTorrentRepository: TorrentRepository;
  let mockResolveTorrentUseCase: ResolveTorrentUseCase;
  let mockContainer: DIContainer;

  beforeEach(() => {
    mockTorrentRepository = {
      search: vi.fn(),
      addTorrentMagnet: vi.fn(),
      getTorrentFiles: vi.fn(),
      pauseTorrent: vi.fn(),
      resumeTorrent: vi.fn(),
      deleteTorrent: vi.fn(),
      getTorrentStreamUrl: vi.fn(),
      getSubtitleVtt: vi.fn(),
      getVideoMetadata: vi.fn(),
      subscribeTorrents: vi.fn().mockResolvedValue(() => {}),
      setTorrentSubject: vi.fn(),
      clearTorrentSubject: vi.fn(),
    };

    mockResolveTorrentUseCase = {
      execute: vi.fn(),
    } as unknown as ResolveTorrentUseCase;

    mockContainer = createDIContainerForTest({
      torrentRepository: mockTorrentRepository,
      resolveTorrentUseCase: mockResolveTorrentUseCase,
    });

    currentLocation.current = null;
    resetAppStores();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderTorrentDetail = (
    initialEntry: string,
    initialEntries = [initialEntry],
  ) => {
    return render(
      <DIProvider value={mockContainer}>
        <MemoryRouter
          initialEntries={initialEntries}
          initialIndex={initialEntries.indexOf(initialEntry)}
        >
          <LocationTracker />
          <Routes>
            <Route path="/" element={<NavBarLayout />}>
              <Route index element={<div>Home Page</div>} />
              <Route path="torrent" element={<TorrentDetail />} />
              <Route path="downloads" element={<div>Downloads Page</div>} />
              <Route
                path="play/:infoHash/:fileId"
                element={<div>Play Page</div>}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </DIProvider>,
    );
  };

  it("当没有提供有效的磁力链接或 Hash 时，应该显示错误提示", async () => {
    vi.mocked(mockResolveTorrentUseCase.execute).mockRejectedValue(
      new Error("未提供有效的磁力链接或种子 Hash"),
    );

    renderTorrentDetail("/torrent?title=mock_title");

    await waitFor(() => {
      expect(
        screen.getByText("未提供有效的磁力链接或种子 Hash"),
      ).toBeInTheDocument();
    });
  });

  it("应该成功通过磁力链接解析种子元数据并渲染文件列表，同时支持点击播放进行跳转", async () => {
    const mockResult: AddTorrentResult = {
      info_hash: NonEmptyStringSchema.parse("hash123"),
      name: NonEmptyStringSchema.parse("测试种子"),
      files: [
        { id: 0, name: NonEmptyStringSchema.parse("file1.mp4"), len: 1000 },
        { id: 1, name: NonEmptyStringSchema.parse("file2.mkv"), len: 2000 },
      ],
    };

    vi.mocked(mockResolveTorrentUseCase.execute).mockResolvedValue(mockResult);

    renderTorrentDetail("/torrent?title=mock_title");

    await waitFor(() => {
      expect(screen.getByText("测试种子")).toBeInTheDocument();
      expect(screen.getByText("共 2 个文件")).toBeInTheDocument();
      expect(screen.getByText("file1.mp4")).toBeInTheDocument();
      expect(screen.getByText("file2.mkv")).toBeInTheDocument();
    });

    const playButtons = screen.getAllByRole("button", { name: "播放" });
    fireEvent.click(playButtons[0]);

    expect(getCurrentLocation()?.pathname).toBe("/play/hash123/0");
    expect(getCurrentLocation()?.search).toContain("title=mock_title");
    expect(getCurrentLocation()?.search).toContain("fileName=file1.mp4");
  });

  it("当解析磁力链接失败时，应该显示相应的解析失败界面（支持 string 错误和非 string 错误）", async () => {
    // 1. String error
    vi.mocked(mockResolveTorrentUseCase.execute).mockRejectedValueOnce(
      "Resolve timeout",
    );

    const { unmount } = renderTorrentDetail("/torrent?title=mock_title");

    await waitFor(() => {
      expect(
        screen.getByText("Resolve timeout", { exact: false }),
      ).toBeInTheDocument();
    });

    unmount();

    // 2. Non-string error (Error object)
    vi.mocked(mockResolveTorrentUseCase.execute).mockRejectedValueOnce(
      new Error("Fatal error"),
    );

    renderTorrentDetail("/torrent?title=mock_title");

    await waitFor(() => {
      expect(
        screen.getByText("Fatal error", { exact: false }),
      ).toBeInTheDocument();
    });
  });

  it("当解析磁力链接失败时点击重试按钮，应该重新发起解析并成功渲染文件列表", async () => {
    const mockResult: AddTorrentResult = {
      info_hash: NonEmptyStringSchema.parse("hash123"),
      name: NonEmptyStringSchema.parse("测试种子"),
      files: [
        { id: 0, name: NonEmptyStringSchema.parse("file1.mp4"), len: 1000 },
      ],
    };
    vi.mocked(mockResolveTorrentUseCase.execute)
      .mockRejectedValueOnce("Resolve timeout")
      .mockResolvedValueOnce(mockResult);

    renderTorrentDetail("/torrent?title=mock_title");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
    });
    expect(
      screen.getByText("Resolve timeout", { exact: false }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    await waitFor(() => {
      expect(screen.getByText("测试种子")).toBeInTheDocument();
      expect(screen.getByText("file1.mp4")).toBeInTheDocument();
    });
    expect(mockResolveTorrentUseCase.execute).toHaveBeenCalledTimes(2);
  });

  it("应该支持使用 infoHash 获取现有种子的缓存文件列表并渲染", async () => {
    const mockResult: AddTorrentResult = {
      info_hash: NonEmptyStringSchema.parse("hash789"),
      name: NonEmptyStringSchema.parse("已缓存种子"),
      files: [
        { id: 0, name: NonEmptyStringSchema.parse("video.mp4"), len: 5000 },
      ],
    };

    vi.mocked(mockResolveTorrentUseCase.execute).mockResolvedValue(mockResult);

    renderTorrentDetail("/torrent?title=已缓存种子");

    await waitFor(() => {
      expect(screen.getByText("已缓存种子")).toBeInTheDocument();
      expect(screen.getByText("video.mp4")).toBeInTheDocument();
    });
  });

  it("当使用 infoHash 获取文件列表失败时，应该显示相应的失败错误提示", async () => {
    vi.mocked(mockResolveTorrentUseCase.execute).mockRejectedValueOnce(
      "Get files error",
    );

    renderTorrentDetail("/torrent?title=mock_title");

    await waitFor(() => {
      expect(
        screen.getByText("Get files error", { exact: false }),
      ).toBeInTheDocument();
    });
  });

  it("应该支持返回操作，并根据是否只有 infoHash 导航到相应的前序页面（包含 Loading、Error 和 Success 状态）", async () => {
    // 1. Loading state (should go to downloads)
    vi.mocked(mockResolveTorrentUseCase.execute).mockImplementation(
      () => new Promise(() => {}),
    );
    const render1 = renderTorrentDetail("/torrent?title=mock_title", [
      "/downloads",
      "/torrent?title=mock_title",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(getCurrentLocation()?.pathname).toBe("/downloads");

    render1.unmount();
    currentLocation.current = null;

    // 2. Loading state (should go to /)
    vi.mocked(mockResolveTorrentUseCase.execute).mockImplementation(
      () => new Promise(() => {}),
    );
    const render2 = renderTorrentDetail("/torrent?title=mock_title", [
      "/",
      "/torrent?title=mock_title",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(getCurrentLocation()?.pathname).toBe("/");

    render2.unmount();
    currentLocation.current = null;

    // 3. Error state (should go to downloads)
    vi.mocked(mockResolveTorrentUseCase.execute).mockRejectedValueOnce(
      "Fetch error",
    );
    const render3 = renderTorrentDetail("/torrent?title=mock_title", [
      "/downloads",
      "/torrent?title=mock_title",
    ]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(getCurrentLocation()?.pathname).toBe("/downloads");

    render3.unmount();
    currentLocation.current = null;

    // 4. Success state (should go to /)
    const mockResult: AddTorrentResult = {
      info_hash: NonEmptyStringSchema.parse("hash123"),
      name: NonEmptyStringSchema.parse("测试种子"),
      files: [
        { id: 0, name: NonEmptyStringSchema.parse("file1.mp4"), len: 1000 },
      ],
    };
    vi.mocked(mockResolveTorrentUseCase.execute).mockResolvedValue(mockResult);

    renderTorrentDetail("/torrent?title=mock_title", [
      "/",
      "/torrent?title=mock_title",
    ]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(getCurrentLocation()?.pathname).toBe("/");
  });

  it("在加载种子的过程中如果组件卸载，应该正常清理而不设置状态或显示 Toast 提示", async () => {
    let resolvePromise: (val: AddTorrentResult) => void = () => {};
    const mockPromise = new Promise<AddTorrentResult>((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(mockResolveTorrentUseCase.execute).mockReturnValue(mockPromise);

    const { unmount } = renderTorrentDetail("/torrent?title=mock_title");

    unmount();

    await act(async () => {
      resolvePromise({
        info_hash: NonEmptyStringSchema.parse("hash123"),
        name: NonEmptyStringSchema.parse("测试"),
        files: [],
      });
    });
  });

  it("应该能通过 infoHash（不带 magnet）加载已缓存的种子文件列表，并且可以点击播放", async () => {
    const mockResult: AddTorrentResult = {
      info_hash: NonEmptyStringSchema.parse("hashCached"),
      name: NonEmptyStringSchema.parse("已缓存种子"),
      files: [
        {
          id: 0,
          name: NonEmptyStringSchema.parse("cached_file.mp4"),
          len: 1000,
        },
      ],
    };

    vi.mocked(mockResolveTorrentUseCase.execute).mockResolvedValue(mockResult);

    renderTorrentDetail("/torrent?title=已缓存种子");

    await waitFor(() => {
      expect(screen.getByText("已缓存种子")).toBeInTheDocument();
      expect(screen.getByText("cached_file.mp4")).toBeInTheDocument();
    });

    const playBtn = screen.getByRole("button", { name: "播放" });
    fireEvent.click(playBtn);

    expect(getCurrentLocation()?.pathname).toBe("/play/hashCached/0");
    expect(getCurrentLocation()?.search).toContain("fileName=cached_file.mp4");
  });

  it("应该对解析和加载种子的非字符串错误正确进行降级处理并显示提示", async () => {
    // 1. execute fails with non-string error
    vi.mocked(mockResolveTorrentUseCase.execute).mockRejectedValueOnce(
      new Error("Fatal error object"),
    );
    const render1 = renderTorrentDetail("/torrent?title=mock_title");
    await waitFor(() => {
      expect(
        screen.getByText("Fatal error object", { exact: false }),
      ).toBeInTheDocument();
    });
    render1.unmount();

    // 2. execute fails with non-string error
    vi.mocked(mockResolveTorrentUseCase.execute).mockRejectedValueOnce(
      new Error("Cache missing object"),
    );
    const render2 = renderTorrentDetail("/torrent?title=mock_title");
    await waitFor(() => {
      expect(
        screen.getByText("Cache missing object", { exact: false }),
      ).toBeInTheDocument();
    });
    render2.unmount();
  });

  it("当解析任务不报错但返回空数据时，应该显示未找到种子数据的空状态", async () => {
    vi.mocked(mockResolveTorrentUseCase.execute).mockResolvedValueOnce(
      null as any,
    );

    renderTorrentDetail("/torrent?title=mock_title");

    await waitFor(() => {
      expect(
        screen.getByText("未找到种子数据", { exact: false }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
    });
  });
});

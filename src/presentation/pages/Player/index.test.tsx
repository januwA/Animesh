import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { Logger } from "@/domain/logger/logger";
import type {
  TorrentStatusInfo,
  VideoMetadata,
} from "@/domain/torrent/TorrentSchemas";
import { TorrentStatusProvider } from "@/presentation/context/TorrentStatusContext";
import Player from "./index";

Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn(),
  },
  writable: true,
});

URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
URL.revokeObjectURL = vi.fn();

const makeStatus = (infoHash: string): TorrentStatusInfo => ({
  info_hash: NonEmptyStringSchema.parse(infoHash),
  name: NonEmptyStringSchema.parse("测试视频"),
  progress_bytes: 400,
  total_bytes: 1000,
  finished: false,
  download_speed_bytes_per_sec: 100,
  upload_speed_bytes_per_sec: 100,
  paused: false,
  peers_connected: 0,
  peers_total: 0,
  trackers: [],
});

const emptyMetadata: VideoMetadata = {
  tracks: [],
  chapters: [],
  video_info: {
    date_utc: null,
    muxing_app: "",
    writing_app: "",
    video_tracks: [],
    audio_tracks: [],
  },
};

const makeLogger = (): Logger => {
  const log: Logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withCategory: () => log,
  };
  return log;
};

const makeContainer = (statuses: TorrentStatusInfo[]): DIContainer =>
  ({
    subscribeTorrentsUseCase: {
      execute: vi
        .fn()
        .mockImplementation(
          async (onUpdate: (torrents: TorrentStatusInfo[]) => void) => {
            onUpdate(statuses);
            return () => {};
          },
        ),
    },
    getTorrentStreamUrlUseCase: {
      execute: vi.fn().mockResolvedValue("http://127.0.0.1/stream/0"),
    },
    getVideoMetadataUseCase: {
      execute: vi.fn().mockResolvedValue(emptyMetadata),
    },
    getSubtitleTranslationsUseCase: {
      execute: vi.fn().mockResolvedValue([]),
    },
    getSubtitleVttUseCase: {
      execute: vi.fn().mockResolvedValue("WEBVTT\n\n"),
    },
    logger: makeLogger(),
  }) as unknown as DIContainer;

const renderPlayer = (container: DIContainer, initialEntry: string) =>
  render(
    <DIProvider value={container}>
      <TorrentStatusProvider>
        <RouterProvider
          router={createMemoryRouter(
            [
              { path: "/", element: <div /> },
              { path: "play/:infoHash", element: <Player /> },
              { path: "play/:infoHash/:fileId", element: <Player /> },
            ],
            { initialEntries: [initialEntry] },
          )}
        />
      </TorrentStatusProvider>
    </DIProvider>,
  );

describe("Player 页面组件", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
  });

  it("缺少文件 ID 参数时应该渲染参数错误提示", async () => {
    renderPlayer(makeContainer([]), "/play/hash123");

    expect(screen.getByText("无效的视频播放参数")).toBeInTheDocument();
    expect(screen.getByText("文件 ID 必须是数字")).toBeInTheDocument();
  });

  it("缺少标题参数时应该渲染参数错误提示", async () => {
    renderPlayer(makeContainer([]), "/play/hash123/0");

    expect(screen.getByText("无效的视频播放参数")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
  });

  it("有种子状态时会执行种子匹配并渲染完整页面", async () => {
    renderPlayer(
      makeContainer([makeStatus("hash123")]),
      "/play/hash123/0?title=测试视频&fileName=video.mp4",
    );

    await waitFor(() => {
      expect(screen.getByText("下载进度: 40.00%")).toBeInTheDocument();
    });
  });
});

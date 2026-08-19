import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { DIProvider } from "@/di/DIContext";
import {
  type NonEmptyString,
  NonEmptyStringSchema,
} from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { resetAppStores } from "@/test/store-reset";
import { createDIContainerForTest } from "@/test/test-utils";
import { TorrentStatusProvider } from "../context/TorrentStatusContext";
import { AppNavBar, PageLoader } from "./AppComponents";

describe("AppComponents 组件", () => {
  beforeEach(() => {
    resetAppStores();
  });

  const makeTorrent = (
    info_hash: NonEmptyString,
    finished: boolean,
    paused: boolean,
  ): TorrentStatusInfo => ({
    info_hash,
    name: info_hash,
    progress_bytes: 0,
    total_bytes: 100,
    finished,
    download_speed_bytes_per_sec: 0,
    upload_speed_bytes_per_sec: 0,
    paused,
    peers_connected: 0,
    peers_total: 0,
    trackers: [],
  });

  it("AppNavBar 应该在 TorrentStatusProvider 下正确渲染", async () => {
    let resolveUnsubscribe: any;
    const unsubMock = vi.fn();
    const promise = new Promise<any>((resolve) => {
      resolveUnsubscribe = () => resolve(unsubMock);
    });

    const mockContainer = createDIContainerForTest({
      subscribeTorrentsUseCase: {
        execute: vi.fn().mockReturnValue(promise),
      } as any,
    });

    const { unmount } = render(
      <DIProvider value={mockContainer}>
        <TorrentStatusProvider>
          <MemoryRouter>
            <AppNavBar />
          </MemoryRouter>
        </TorrentStatusProvider>
      </DIProvider>,
    );

    unmount();
    resolveUnsubscribe();

    await promise;
    expect(unsubMock).toHaveBeenCalled();
  });

  it("AppNavBar 应该只统计未完成且未暂停的任务，并在下载导航项上显示数量角标", async () => {
    const mockContainer = createDIContainerForTest({
      subscribeTorrentsUseCase: {
        execute: vi
          .fn()
          .mockImplementation(
            (onUpdate: (list: TorrentStatusInfo[]) => void) => {
              onUpdate([
                makeTorrent(
                  NonEmptyStringSchema.parse("hash-finished"),
                  true,
                  false,
                ),
                makeTorrent(
                  NonEmptyStringSchema.parse("hash-paused"),
                  false,
                  true,
                ),
                makeTorrent(
                  NonEmptyStringSchema.parse("hash-active"),
                  false,
                  false,
                ),
              ]);
              return Promise.resolve(() => {});
            },
          ),
      } as any,
    });

    render(
      <DIProvider value={mockContainer}>
        <TorrentStatusProvider>
          <MemoryRouter initialEntries={["/downloads"]}>
            <AppNavBar />
          </MemoryRouter>
        </TorrentStatusProvider>
      </DIProvider>,
    );

    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  it("PageLoader 应该在加载时显示加载提示", async () => {
    render(<PageLoader />);
    expect(await screen.findByText("正在载入页面...")).toBeInTheDocument();
  });
});

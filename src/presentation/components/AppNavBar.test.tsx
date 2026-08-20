import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { type DIContainer, DIProvider } from "@/di/DIContext";
import {
  type NonEmptyString,
  NonEmptyStringSchema,
} from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { resetAppStores } from "@/test/store-reset";
import { TorrentStatusProvider } from "../context/TorrentStatusContext";
import { AppNavBar } from "./AppNavBar";

describe("AppNavBar 组件", () => {
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

  function renderNavBar(
    initialEntry = "/",
    onExecute?: (pushList: (list: TorrentStatusInfo[]) => void) => void,
  ) {
    const mockContainer = {
      subscribeTorrentsUseCase: {
        execute: (cb: (list: TorrentStatusInfo[]) => void) => {
          onExecute?.(cb);
          return Promise.resolve(() => {});
        },
      } as unknown,
    };

    render(
      <DIProvider value={mockContainer as DIContainer}>
        <TorrentStatusProvider>
          <MemoryRouter initialEntries={[initialEntry]}>
            <AppNavBar />
          </MemoryRouter>
        </TorrentStatusProvider>
      </DIProvider>,
    );
  }

  it("应该在 TorrentStatusProvider 下正确订阅并在卸载时取消订阅", async () => {
    let resolveUnsubscribe: () => void = () => {};
    const unsubMock = vi.fn();
    const promise = new Promise<() => void>((resolve) => {
      resolveUnsubscribe = () => resolve(unsubMock);
    });

    const mockContainer = {
      subscribeTorrentsUseCase: {
        execute: vi.fn().mockReturnValue(promise),
      } as unknown,
    };

    const { unmount } = render(
      <DIProvider value={mockContainer as DIContainer}>
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

  it("应该渲染 4 个主导航项与更多按钮，更多菜单项默认隐藏", () => {
    renderNavBar();

    expect(screen.getByRole("link", { name: "搜索" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "新番" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "收藏" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下载" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更多" })).toBeInTheDocument();

    expect(screen.queryByText("动漫")).not.toBeInTheDocument();
    expect(screen.queryByText("直播")).not.toBeInTheDocument();
    expect(screen.queryByText("设置")).not.toBeInTheDocument();
  });

  it("应该只统计未完成且未暂停的任务，并在下载导航项上显示数量角标", async () => {
    renderNavBar("/downloads", (pushList) => {
      pushList([
        makeTorrent(NonEmptyStringSchema.parse("hash-finished"), true, false),
        makeTorrent(NonEmptyStringSchema.parse("hash-paused"), false, true),
        makeTorrent(NonEmptyStringSchema.parse("hash-active"), false, false),
      ]);
    });

    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  it("点击更多按钮应展开菜单，显示动漫、直播、设置", async () => {
    const user = userEvent.setup();
    renderNavBar();

    await user.click(screen.getByRole("button", { name: "更多" }));

    expect(
      await screen.findByRole("menuitem", { name: "动漫" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "直播" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "设置" })).toBeInTheDocument();
  });

  it("路由命中更多菜单项时，更多按钮应呈现高亮态", async () => {
    renderNavBar("/search");

    const moreButton = screen.getByRole("button", { name: "更多" });
    expect(moreButton.className).toContain("bg-primary/10");

    cleanup();
    renderNavBar("/");

    expect(
      screen.getByRole("button", { name: "更多" }).className,
    ).not.toContain("bg-primary/10");
  });
});

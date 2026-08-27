import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import {
  TorrentStatusContext,
  type TorrentStatusContextType,
} from "../context/TorrentStatusContext";
import { AppNavBar } from "./AppNavBar";

describe("AppNavBar 组件", () => {
  const makeTorrent = (
    info_hash: TorrentStatusInfo["info_hash"],
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
    torrentStatus: Partial<TorrentStatusContextType> = {},
  ) {
    const contextValue: TorrentStatusContextType = {
      torrents: [],
      isLoading: false,
      ...torrentStatus,
    };

    return render(
      <TorrentStatusContext value={contextValue}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <AppNavBar />
        </MemoryRouter>
      </TorrentStatusContext>,
    );
  }

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("应该渲染 5 个主导航项与更多按钮，更多菜单项默认隐藏", () => {
    renderNavBar();

    expect(screen.getByRole("link", { name: "搜索" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bangumi" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AniList" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "收藏" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下载" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更多" })).toBeInTheDocument();

    expect(screen.queryByText("直播")).not.toBeInTheDocument();
    expect(screen.queryByText("设置")).not.toBeInTheDocument();
  });

  it("应该只统计未完成且未暂停的任务，并在下载导航项上显示数量角标", () => {
    const torrents = [
      makeTorrent(
        "hash-finished" as TorrentStatusInfo["info_hash"],
        true,
        false,
      ),
      makeTorrent("hash-paused" as TorrentStatusInfo["info_hash"], false, true),
      makeTorrent(
        "hash-active" as TorrentStatusInfo["info_hash"],
        false,
        false,
      ),
    ];

    renderNavBar("/downloads", { torrents });

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("没有正在下载的任务时，不应该显示下载数量角标", () => {
    const torrents = [
      makeTorrent(
        "hash-finished" as TorrentStatusInfo["info_hash"],
        true,
        false,
      ),
      makeTorrent("hash-paused" as TorrentStatusInfo["info_hash"], false, true),
    ];

    renderNavBar("/downloads", { torrents });

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("点击更多按钮应展开菜单，显示直播、设置", async () => {
    const user = userEvent.setup();

    renderNavBar();

    await user.click(screen.getByRole("button", { name: "更多" }));

    expect(screen.getByRole("menuitem", { name: "直播" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "设置" })).toBeInTheDocument();
  });

  it("路由命中更多菜单项时，更多按钮应呈现高亮态", () => {
    renderNavBar("/live");

    const moreButton = screen.getByRole("button", { name: "更多" });

    expect(moreButton.className).toContain("bg-primary/10");
  });

  it("路由未命中更多菜单项时，更多按钮不应该呈现高亮态", () => {
    renderNavBar("/");

    const moreButton = screen.getByRole("button", { name: "更多" });

    expect(moreButton.className).not.toContain("bg-primary/10");
  });
});

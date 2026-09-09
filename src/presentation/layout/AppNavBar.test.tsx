import { cleanup, render, screen } from "@testing-library/react";
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

  it("应该渲染 7 个主导航项", () => {
    renderNavBar();

    expect(screen.getByRole("link", { name: "搜索" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bangumi" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AniList" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "收藏" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下载" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "直播" })).toBeInTheDocument();
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

  it("路由命中直播时，直播导航项应呈现高亮态", () => {
    renderNavBar("/live");

    const liveLink = screen.getByRole("link", { name: "直播" });

    expect(liveLink.className).toContain("bg-primary/10");
  });

  it("路由未命中直播时，直播导航项不应该呈现高亮态", () => {
    renderNavBar("/");

    const liveLink = screen.getByRole("link", { name: "直播" });

    expect(liveLink.className).not.toContain("bg-primary/10");
  });

  it("路由命中 bangumi 平台时，Bangumi 导航项应呈现高亮态", () => {
    renderNavBar("/anime?platform=bangumi");

    const bangumiLink = screen.getByRole("link", { name: "Bangumi" });

    expect(bangumiLink.className).toContain("bg-primary/10");
  });

  it("路由命中 anilist 平台时，Bangumi 导航项不应该呈现高亮态", () => {
    renderNavBar("/anime?platform=anilist");

    const bangumiLink = screen.getByRole("link", { name: "Bangumi" });

    expect(bangumiLink.className).not.toContain("bg-primary/10");
  });
});

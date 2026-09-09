import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import TorrentDetail from "./index";
import { TorrentDetailContent } from "./TorrentDetailContent";

vi.mock("./TorrentDetailContent", () => ({
  TorrentDetailContent: vi.fn(() => <div>torrent-detail-content</div>),
}));

const mockTorrentDetailContent = vi.mocked(TorrentDetailContent);

const renderPage = (initialEntry: string) => {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <TorrentDetail />
    </MemoryRouter>,
  );
};

describe("TorrentDetail 种子详情页参数校验", () => {
  it("未提供任何参数时应该显示参数错误视图", () => {
    renderPage("/torrent-detail");

    expect(screen.getByText("无效的种子详情参数")).toBeInTheDocument();
    expect(
      screen.getByText("请提供磁力链接或种子 Hash（二选一）"),
    ).toBeInTheDocument();
    expect(mockTorrentDetailContent).not.toHaveBeenCalled();
  });

  it("同时提供 magnet 和 infoHash 时应该显示参数错误视图", () => {
    renderPage(
      "/torrent-detail?magnet=magnet%3A%3Fxt%3Durn%3Abtih%3Aabc&infoHash=abc",
    );

    expect(screen.getByText("无效的种子详情参数")).toBeInTheDocument();
    expect(mockTorrentDetailContent).not.toHaveBeenCalled();
  });

  it("magnet 为空串时应视为未提供并显示错误视图", () => {
    renderPage("/torrent-detail?magnet=");

    expect(screen.getByText("无效的种子详情参数")).toBeInTheDocument();
    expect(mockTorrentDetailContent).not.toHaveBeenCalled();
  });

  it("仅提供 magnet 时应该透传给内容组件", () => {
    renderPage("/torrent-detail?magnet=magnet%3A%3Fxt%3Durn%3Abtih%3Aabc");

    expect(mockTorrentDetailContent).toHaveBeenCalledWith(
      { magnet: "magnet:?xt=urn:btih:abc", infoHash: undefined },
      undefined,
    );
  });

  it("仅提供 infoHash 时应该透传给内容组件", () => {
    renderPage("/torrent-detail?infoHash=abc123");

    expect(mockTorrentDetailContent).toHaveBeenCalledWith(
      { magnet: undefined, infoHash: "abc123" },
      undefined,
    );
  });
});

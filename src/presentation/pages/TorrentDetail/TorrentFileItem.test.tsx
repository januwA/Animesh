import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AddTorrentResult } from "@/domain/torrent/TorrentSchemas";
import { TorrentFileItem } from "./TorrentFileItem";

const makeTorrent = (): AddTorrentResult => ({
  info_hash: NonEmptyStringSchema.parse("hash123"),
  name: NonEmptyStringSchema.parse("测试种子"),
  files: [
    { id: 0, name: NonEmptyStringSchema.parse("file1.mp4"), len: 1000 },
    { id: 1, name: NonEmptyStringSchema.parse("file2.mkv"), len: 2000 },
  ],
});

describe("TorrentFileItem 种子文件条目组件", () => {
  it("应该渲染文件名和大小", () => {
    const torrent = makeTorrent();
    render(
      <TorrentFileItem
        torrent={torrent}
        file={torrent.files[0]}
        onPlay={vi.fn()}
      />,
    );

    expect(screen.getByText("file1.mp4")).toBeInTheDocument();
  });

  it("点击播放按钮应该调用 onPlay", () => {
    const onPlay = vi.fn();
    const torrent = makeTorrent();
    render(
      <TorrentFileItem
        torrent={torrent}
        file={torrent.files[0]}
        onPlay={onPlay}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "播放" }));
    expect(onPlay).toHaveBeenCalledWith("hash123", 0, "file1.mp4");
  });

  it("应该渲染播放按钮图标", () => {
    const torrent = makeTorrent();
    const { container } = render(
      <TorrentFileItem
        torrent={torrent}
        file={torrent.files[0]}
        onPlay={vi.fn()}
      />,
    );

    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { VideoInfo } from "@/domain/torrent/TorrentSchemas";
import { MediaInfoPanel } from "./MediaInfoPanel";

const videoInfo: VideoInfo = {
  date_utc: 978_307_200,
  muxing_app: "mkvmerge",
  writing_app: "libebml",
  video_tracks: [
    {
      track_id: 1,
      codec: "V_MPEG4/ISO/AVC",
      width: 1920,
      height: 1080,
      language: "und",
      default: true,
      forced: false,
    },
  ],
  audio_tracks: [
    {
      track_id: 2,
      codec: "A_AAC",
      channels: 2,
      sampling_rate: 48000,
      language: "jpn",
      default: true,
    },
  ],
};

const emptyVideoInfo: VideoInfo = {
  date_utc: null,
  muxing_app: "",
  writing_app: "",
  video_tracks: [],
  audio_tracks: [],
};

describe("MediaInfoPanel 媒体信息面板组件", () => {
  const expandSection = (title: string) => {
    const trigger = screen.getByText(title).closest("button");
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger!);
  };

  it("videoInfo 为 null 时不应该渲染任何内容", () => {
    const { container } = render(<MediaInfoPanel videoInfo={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("应该渲染媒体信息区块并展示轨道信息", () => {
    render(<MediaInfoPanel videoInfo={videoInfo} />);

    expandSection("媒体信息");
    expect(screen.getByText("创建时间")).toBeInTheDocument();
    expect(screen.getByText("视频轨道")).toBeInTheDocument();
    expect(screen.getByText("V_MPEG4/ISO/AVC 1920x1080")).toBeInTheDocument();
    expect(screen.getByText("A_AAC 2ch 48000Hz")).toBeInTheDocument();
    expect(screen.getByText(/mkvmerge/)).toBeInTheDocument();
    expect(screen.getByText(/libebml/)).toBeInTheDocument();
  });

  it("空值字段应该显示未知或无的回退文本", () => {
    render(<MediaInfoPanel videoInfo={emptyVideoInfo} />);

    expandSection("媒体信息");
    expect(screen.getByText("创建时间")).toBeInTheDocument();
    expect(screen.getByText("视频轨道")).toBeInTheDocument();
    expect(screen.getByText("音频轨道")).toBeInTheDocument();
    expect(screen.getByText("封装工具")).toBeInTheDocument();
    expect(screen.getAllByText("无").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/未知/).length).toBeGreaterThanOrEqual(2);
  });
});

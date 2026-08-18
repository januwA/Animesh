import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import { PlayerVideo } from "./PlayerVideo";
import type { SubtitleSource } from "./usePlayerSubtitle";

describe("PlayerVideo 播放器视频组件", () => {
  const subtitleSources: Record<number | string, SubtitleSource> = {
    1: {
      url: NonEmptyStringSchema.parse("blob:subtitle-1"),
      loadedAtFraction: 0.4,
      loadedWhenFinished: false,
    },
  };

  const subtitles = [
    { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
    { id: 2, language: "chi", title: "Chinese", codec: "S_TEXT/UTF8" },
  ];

  it("无法播放时应该渲染加载图标", () => {
    const { container } = render(
      <PlayerVideo
        canPlay={false}
        streamUrl=""
        subtitleTracks={subtitles}
        selectedTrackId={null}
        subtitleSources={{}}
      />,
    );

    expect(container.querySelector(".animate-spin")).not.toBeNull();
    expect(container.querySelector("video")).toBeNull();
  });

  it("可以播放但流地址为空时应该渲染加载图标", () => {
    const { container } = render(
      <PlayerVideo
        canPlay
        streamUrl={null}
        subtitleTracks={subtitles}
        selectedTrackId={null}
        subtitleSources={{}}
      />,
    );

    expect(container.querySelector(".animate-spin")).not.toBeNull();
    expect(container.querySelector("video")).toBeNull();
  });

  it("可以播放时应该渲染视频元素与选中的字幕轨道", () => {
    const { container } = render(
      <PlayerVideo
        canPlay
        streamUrl="http://127.0.0.1/stream/0"
        subtitleTracks={subtitles}
        selectedTrackId={1}
        subtitleSources={subtitleSources}
      />,
    );

    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.getAttribute("src")).toBe("http://127.0.0.1/stream/0");

    const track = video.querySelector("track") as HTMLTrackElement;
    expect(track).not.toBeNull();
    expect(track.getAttribute("kind")).toBe("subtitles");
    expect(track.getAttribute("src")).toBe("blob:subtitle-1");
    expect(track.getAttribute("srclang")).toBe("eng");
    expect(track.getAttribute("label")).toBe("English");
    expect(track.getAttribute("default")).not.toBeNull();
  });

  it("只渲染与选中轨道匹配的字幕轨道", () => {
    const { container } = render(
      <PlayerVideo
        canPlay
        streamUrl="http://127.0.0.1/stream/0"
        subtitleTracks={subtitles}
        selectedTrackId={2}
        subtitleSources={{}}
      />,
    );

    const video = container.querySelector("video") as HTMLVideoElement;
    const tracks = video.querySelectorAll("track");
    expect(tracks).toHaveLength(1);
    expect(tracks[0].getAttribute("id")).toBe("2");
    expect(tracks[0].getAttribute("srclang")).toBe("chi");
  });

  it("选中轨道未加载 VTT 时不应该设置 src，且标题为空时回退为轨道编号", () => {
    const { container } = render(
      <PlayerVideo
        canPlay
        streamUrl="http://127.0.0.1/stream/0"
        subtitleTracks={[
          { id: 3, language: "", title: "", codec: "S_TEXT/UTF8" },
        ]}
        selectedTrackId={3}
        subtitleSources={{}}
      />,
    );

    const video = container.querySelector("video") as HTMLVideoElement;
    const track = video.querySelector("track") as HTMLTrackElement;
    expect(track).not.toBeNull();
    expect(track.hasAttribute("src")).toBe(false);
    expect(track.getAttribute("label")).toBe("轨道 3");
  });

  it("没有匹配的字幕轨道时不应该渲染 track 元素", () => {
    const { container } = render(
      <PlayerVideo
        canPlay
        streamUrl="http://127.0.0.1/stream/0"
        subtitleTracks={subtitles}
        selectedTrackId={null}
        subtitleSources={{}}
      />,
    );

    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video.querySelectorAll("track")).toHaveLength(0);
  });
});

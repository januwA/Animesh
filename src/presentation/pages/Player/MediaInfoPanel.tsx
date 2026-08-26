import { Info } from "lucide-react";
import { Fragment } from "react";
import type { VideoInfo } from "@/domain/torrent/TorrentSchemas";
import { CollapsibleSection } from "./CollapsibleSection";

export interface MediaInfoPanelProps {
  videoInfo: VideoInfo | null;
}

interface MediaEntryLine {
  key: string;
  text: string;
}

interface MediaEntry {
  label: string;
  lines: MediaEntryLine[];
}

function toLines(...texts: string[]): MediaEntryLine[] {
  return texts.map((text, index) => ({ key: `${index}-${text}`, text }));
}

function buildMediaInfoEntries(videoInfo: VideoInfo): MediaEntry[] {
  return [
    {
      label: "创建时间",
      lines: toLines(
        videoInfo.date_utc !== null
          ? new Date(videoInfo.date_utc * 1000).toLocaleString()
          : "未知",
      ),
    },
    {
      label: "视频轨道",
      lines: toLines(
        videoInfo.video_tracks.length > 0
          ? videoInfo.video_tracks
              .map((t) => `${t.codec} ${t.width}x${t.height}`)
              .join(" / ")
          : "无",
      ),
    },
    {
      label: "音频轨道",
      lines: toLines(
        videoInfo.audio_tracks.length > 0
          ? videoInfo.audio_tracks
              .map((t) => `${t.codec} ${t.channels}ch ${t.sampling_rate}Hz`)
              .join(" / ")
          : "无",
      ),
    },
    {
      label: "封装工具",
      lines: toLines(
        videoInfo.muxing_app || "未知",
        videoInfo.writing_app || "未知",
      ),
    },
  ];
}

export function MediaInfoPanel({ videoInfo }: MediaInfoPanelProps) {
  if (!videoInfo) return null;
  const mediaEntries = buildMediaInfoEntries(videoInfo);
  return (
    <CollapsibleSection
      title="媒体信息"
      icon={<Info className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="flex flex-col divide-y divide-border">
        {mediaEntries.map((entry) => (
          <div key={entry.label} className="flex flex-col gap-1 py-2">
            <span className="tracking-wider text-muted-foreground">
              {entry.label}
            </span>
            <span className="font-semibold wrap-break-word">
              {entry.lines.map((line, i) => (
                <Fragment key={line.key}>
                  {line.text}
                  {i < entry.lines.length - 1 && <br />}
                </Fragment>
              ))}
            </span>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

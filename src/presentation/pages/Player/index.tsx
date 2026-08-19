import { useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { useTorrentStatus } from "@/presentation/context/TorrentStatusContext";
import { AiTranslateButton } from "./AiTranslateButton";
import { ChaptersSection } from "./ChaptersSection";
import { CopyStreamUrlButton } from "./CopyStreamUrlButton";
import { DownloadStatsPanel } from "./DownloadStatsPanel";
import { JsPlayerErrorMonitor } from "./JsPlayerErrorMonitor";
import { MediaInfoPanel } from "./MediaInfoPanel";
import { PlayerBackButton } from "./PlayerBackButton";
import { PlayerSubtitleSelector } from "./PlayerSubtitleSelector";
import { PlayerTitle } from "./PlayerTitle";
import { PlayerVideo } from "./PlayerVideo";
import { JsPlayer } from "./player";
import { TrackerSection } from "./TrackerSection";
import { usePlayerData } from "./usePlayerData";
import { usePlayerSubtitle } from "./usePlayerSubtitle";
import "@videojs/react/video/skin.css";

const playerParamsSchema = z.object({
  infoHash: NonEmptyStringSchema.min(1, "缺少种子哈希参数"),
  fileId: z.preprocess(
    (value) =>
      typeof value === "string" && value !== "" ? Number(value) : value,
    z.number({ message: "文件 ID 必须是数字" }).int("文件 ID 必须是整数"),
  ),
  title: NonEmptyStringSchema,
  fileName: NonEmptyStringSchema,
});

export default function Player() {
  const { infoHash, fileId } = useParams<{
    infoHash: string;
    fileId: string;
  }>();
  const [searchParams] = useSearchParams();

  const parsed = playerParamsSchema.safeParse({
    infoHash,
    fileId,
    title: searchParams.get("title") ?? undefined,
    fileName: searchParams.get("fileName") ?? undefined,
  });
  if (!parsed.success) {
    return (
      <InvalidParamsView title="无效的视频播放参数" error={parsed.error} />
    );
  }

  return <PlayerView {...parsed.data} />;
}

function PlayerView({
  infoHash,
  fileId,
  title,
  fileName,
}: z.infer<typeof playerParamsSchema>) {
  const {
    getTorrentStreamUrlUseCase,
    getVideoMetadataUseCase,
    getSubtitleTranslationsUseCase,
    getSubtitleVttUseCase,
    logger,
  } = useDI();
  const { torrents } = useTorrentStatus();
  const torrentStatus = torrents.find((t) => t?.info_hash === infoHash) ?? null;
  // 下载进度百分比
  const downloadProgress =
    torrentStatus && torrentStatus.total_bytes > 0
      ? (torrentStatus.progress_bytes / torrentStatus.total_bytes) * 100
      : 0;

  const {
    streamUrl,
    originalSubtitleTracks,
    subtitleTracks,
    chapters,
    videoInfo,
  } = usePlayerData(
    { infoHash, fileId, torrentStatus, downloadProgress },
    {
      getTorrentStreamUrlUseCase,
      getVideoMetadataUseCase,
      getSubtitleTranslationsUseCase,
    },
  );

  const {
    subtitleSources,
    selectedTrackId,
    subtitleMutation,
    handleSubtitleChange,
  } = usePlayerSubtitle(
    {
      infoHash,
      fileId,
      originalSubtitleTracks,
      torrentStatus,
      downloadProgress,
    },
    { getSubtitleVttUseCase },
  );

  const canPlay = !!streamUrl && !!torrentStatus && downloadProgress >= 1;

  return (
    <JsPlayer.Provider>
      <div className="w-full flex flex-col gap-4 lg:gap-6 animate-in fade-in duration-300">
        {/* Navigation Header */}
        <PlayerBackButton />

        {/* Player Video */}
        <div className="relative w-full aspect-video max-h-dvh overflow-hidden">
          <PlayerVideo
            canPlay={canPlay}
            streamUrl={streamUrl}
            subtitleTracks={subtitleTracks}
            selectedTrackId={selectedTrackId}
            subtitleSources={subtitleSources}
          />
        </div>

        {/* Title & Actions */}
        <div className="flex flex-col gap-3">
          <PlayerTitle fileName={fileName} title={title} />

          <div className="flex flex-wrap items-center gap-2">
            <PlayerSubtitleSelector
              tracks={subtitleTracks}
              selectedTrackId={selectedTrackId}
              onChange={handleSubtitleChange}
              loading={subtitleMutation.loading}
            />
            <AiTranslateButton
              infoHash={infoHash}
              fileId={fileId}
              title={title}
              fileName={fileName}
            />
            <CopyStreamUrlButton streamUrl={streamUrl} />
          </div>
        </div>

        {/* Progress & Stats */}
        <DownloadStatsPanel
          torrentStatus={torrentStatus}
          downloadProgress={downloadProgress}
        />

        {/* Tracker 列表 */}
        <TrackerSection trackers={torrentStatus?.trackers ?? []} />

        {/* Chapters */}
        <ChaptersSection chapters={chapters} />

        {/* Media Info */}
        <MediaInfoPanel videoInfo={videoInfo} />
      </div>

      {canPlay && <JsPlayerErrorMonitor logger={logger} />}
    </JsPlayer.Provider>
  );
}

import { z } from "zod";

export const SearchResultItemSchema = z.object({
  title: z.string(),
  link: z.string(),
  pub_date: z.string(),
  magnet: z.string(),
  description: z.string(),
});

export const FileDetailsSchema = z.object({
  id: z.number(),
  name: z.string(),
  len: z.number(),
});

export const AddTorrentResultSchema = z.object({
  info_hash: z.string(),
  name: z.string(),
  files: z.array(FileDetailsSchema),
});

export const TorrentStatusInfoSchema = z.object({
  info_hash: z.string(),
  name: z.string(),
  progress_bytes: z.number(),
  total_bytes: z.number(),
  finished: z.boolean(),
  download_speed_bytes_per_sec: z.number(),
  upload_speed_bytes_per_sec: z.number(),
  paused: z.boolean(),
  peers_connected: z.number(),
  peers_total: z.number(),
  created_at: z.number().optional(),
  trackers: z.array(z.string()).default([]),
});

export const SubtitleTrackInfoSchema = z.object({
  id: z.number(),
  language: z.string(),
  title: z.string(),
  codec: z.string(),
});

export const ChapterInfoSchema = z.object({
  start_ms: z.number(),
  end_ms: z.number().nullable(),
  title: z.string(),
  language: z.string().nullable(),
});

export const VideoTrackInfoSchema = z.object({
  track_id: z.number(),
  codec: z.string(),
  width: z.number(),
  height: z.number(),
  language: z.string().nullable(),
  default: z.boolean(),
  forced: z.boolean(),
});

export const AudioTrackInfoSchema = z.object({
  track_id: z.number(),
  codec: z.string(),
  channels: z.number(),
  sampling_rate: z.number(),
  language: z.string().nullable(),
  default: z.boolean(),
});

export const VideoInfoSchema = z.object({
  date_utc: z.number().nullable(),
  muxing_app: z.string(),
  writing_app: z.string(),
  video_tracks: z.array(VideoTrackInfoSchema),
  audio_tracks: z.array(AudioTrackInfoSchema),
});

export const VideoMetadataSchema = z.object({
  tracks: z.array(SubtitleTrackInfoSchema),
  chapters: z.array(ChapterInfoSchema),
  video_info: VideoInfoSchema,
});

export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;
export type FileDetails = z.infer<typeof FileDetailsSchema>;
export type AddTorrentResult = z.infer<typeof AddTorrentResultSchema>;
export type TorrentStatusInfo = z.infer<typeof TorrentStatusInfoSchema>;
export type SubtitleTrackInfo = z.infer<typeof SubtitleTrackInfoSchema>;
export type ChapterInfo = z.infer<typeof ChapterInfoSchema>;
export type VideoTrackInfo = z.infer<typeof VideoTrackInfoSchema>;
export type AudioTrackInfo = z.infer<typeof AudioTrackInfoSchema>;
export type VideoInfo = z.infer<typeof VideoInfoSchema>;
export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

export interface AiSearchResultItem extends SearchResultItem {
  ai_score?: number;
  ai_reason?: string;
}

import { z } from "zod";

export const SearchResultItemSchema = z.object({
	title: z.string(),
	link: z.string(),
	pub_date: z.string(),
	magnet: z.string(),
	size: z.number().nullable(),
});

export const FileDetailsSchema = z.object({
	id: z.number(),
	name: z.string(),
	len: z.number(),
});

export const AddTorrentResultSchema = z.object({
	info_hash: z.string(),
	name: z.string().nullable(),
	files: z.array(FileDetailsSchema),
});

export const TorrentStatusInfoSchema = z.object({
	info_hash: z.string(),
	name: z.string().nullable(),
	progress_bytes: z.number(),
	total_bytes: z.number(),
	finished: z.boolean(),
	download_speed_bytes_per_sec: z.number(),
	paused: z.boolean(),
	peers_connected: z.number(),
	peers_total: z.number(),
	created_at: z.number().optional(),
});

export const SubtitleTrackInfoSchema = z.object({
	id: z.number(),
	language: z.string(),
	title: z.string(),
	codec: z.string(),
});

export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;
export type FileDetails = z.infer<typeof FileDetailsSchema>;
export type AddTorrentResult = z.infer<typeof AddTorrentResultSchema>;
export type TorrentStatusInfo = z.infer<typeof TorrentStatusInfoSchema>;
export type SubtitleTrackInfo = z.infer<typeof SubtitleTrackInfoSchema>;

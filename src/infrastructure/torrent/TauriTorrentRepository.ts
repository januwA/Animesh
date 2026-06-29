import { Channel, invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import {
	type AddTorrentResult,
	AddTorrentResultSchema,
	type FileDetails,
	FileDetailsSchema,
	type SearchResultItem,
	SearchResultItemSchema,
	type SubtitleTrackInfo,
	SubtitleTrackInfoSchema,
	type TorrentStatusInfo,
	TorrentStatusInfoSchema,
} from "../../domain/torrent/TorrentSchemas";

export class TauriTorrentRepository implements TorrentRepository {
	async search(keyword: string, engine: string): Promise<SearchResultItem[]> {
		const raw = await invoke<unknown>("search_torrents", { keyword, engine });
		const result = z.array(SearchResultItemSchema).safeParse(raw);
		if (!result.success) {
			throw new Error("search_torrents API structure mismatch", {
				cause: result.error,
			});
		}
		return result.data;
	}

	async listTorrents(): Promise<TorrentStatusInfo[]> {
		const raw = await invoke<unknown>("torrent_list");
		const result = z.array(TorrentStatusInfoSchema).safeParse(raw);
		if (!result.success) {
			throw new Error("torrent_list API structure mismatch", {
				cause: result.error,
			});
		}
		return result.data;
	}

	async pauseTorrent(infoHash: string): Promise<void> {
		return invoke<void>("torrent_pause", { infoHash });
	}

	async resumeTorrent(infoHash: string): Promise<void> {
		return invoke<void>("torrent_resume", { infoHash });
	}

	async deleteTorrent(infoHash: string, deleteFiles: boolean): Promise<void> {
		return invoke<void>("torrent_delete", { infoHash, deleteFiles });
	}

	async addTorrentMagnet(magnet: string): Promise<AddTorrentResult> {
		const raw = await invoke<unknown>("torrent_add_magnet", { magnet });
		const result = AddTorrentResultSchema.safeParse(raw);
		if (!result.success) {
			throw new Error("torrent_add_magnet API structure mismatch", {
				cause: result.error,
			});
		}
		return result.data;
	}

	async getTorrentFiles(infoHash: string): Promise<FileDetails[]> {
		const raw = await invoke<unknown>("torrent_get_files", { infoHash });
		const result = z.array(FileDetailsSchema).safeParse(raw);
		if (!result.success) {
			throw new Error("torrent_get_files API structure mismatch", {
				cause: result.error,
			});
		}
		return result.data;
	}

	async getTorrentStreamUrl(infoHash: string, fileId: number): Promise<string> {
		return invoke<string>("torrent_get_stream_url", { infoHash, fileId });
	}

	async getTorrentStatus(infoHash: string): Promise<TorrentStatusInfo> {
		const raw = await invoke<unknown>("torrent_get_status", { infoHash });
		const result = TorrentStatusInfoSchema.safeParse(raw);
		if (!result.success) {
			throw new Error("torrent_get_status API structure mismatch", {
				cause: result.error,
			});
		}
		return result.data;
	}

	async getSubtitleTracks(
		infoHash: string,
		fileId: number,
	): Promise<SubtitleTrackInfo[]> {
		const raw = await invoke<unknown>("torrent_get_subtitle_tracks", {
			infoHash,
			fileId,
		});
		const result = z.array(SubtitleTrackInfoSchema).safeParse(raw);
		if (!result.success) {
			throw new Error("torrent_get_subtitle_tracks API structure mismatch", {
				cause: result.error,
			});
		}
		return result.data;
	}

	async getSubtitleVtt(
		infoHash: string,
		fileId: number,
		trackId: number,
	): Promise<string> {
		return invoke<string>("torrent_get_subtitle_vtt", {
			infoHash,
			fileId,
			trackId,
		});
	}

	async subscribeTorrents(
		onUpdate: (torrents: TorrentStatusInfo[]) => void,
	): Promise<() => void> {
		const channel = new Channel<unknown>((data) => {
			const result = z.array(TorrentStatusInfoSchema).safeParse(data);
			if (!result.success) {
				throw new Error("torrent_subscribe API structure mismatch", {
					cause: result.error,
				});
			}
			onUpdate(result.data);
		});

		await invoke<void>("torrent_subscribe", { onEvent: channel });

		return () => {};
	}
}

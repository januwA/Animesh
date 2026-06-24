import { invoke } from "@tauri-apps/api/core";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import type {
	AddTorrentResult,
	FileDetails,
	SearchResultItem,
	TorrentStatusInfo,
} from "../../types";

export class TauriTorrentRepository implements TorrentRepository {
	async searchDmhy(keyword: string): Promise<SearchResultItem[]> {
		return invoke<SearchResultItem[]>("search_dmhy", { keyword });
	}

	async listTorrents(): Promise<TorrentStatusInfo[]> {
		return invoke<TorrentStatusInfo[]>("torrent_list");
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
		return invoke<AddTorrentResult>("torrent_add_magnet", { magnet });
	}

	async getTorrentFiles(infoHash: string): Promise<FileDetails[]> {
		return invoke<FileDetails[]>("torrent_get_files", { infoHash });
	}

	async getTorrentStreamUrl(infoHash: string, fileId: number): Promise<string> {
		return invoke<string>("torrent_get_stream_url", { infoHash, fileId });
	}

	async getTorrentStatus(infoHash: string): Promise<TorrentStatusInfo> {
		return invoke<TorrentStatusInfo>("torrent_get_status", { infoHash });
	}
}

import type { Context } from "ajanuw-context";
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
import { HttpClient } from "../http/HttpClient";

const baseUrl = import.meta.env.PROD
	? "/api"
	: (import.meta.env.VITE_API_BASE_URL as string) || "/api";

export class HttpTorrentRepository implements TorrentRepository {
	private readonly httpClient: HttpClient;

	constructor() {
		this.httpClient = new HttpClient();
	}

	private registerSearchCancellation(
		ctx: Context,
		traceId: string,
		status: { isFinished: boolean },
	): void {
		ctx.done().then(() => {
			if (!status.isFinished) {
				this.httpClient
					.request(`${baseUrl}/torrents/search/${traceId}`, {
						method: "DELETE",
					})
					.catch(() => {});
			}
		});
	}

	async search(
		ctx: Context,
		keyword: string,
		engine: string,
	): Promise<SearchResultItem[]> {
		const traceId = ctx.value<string>("traceId") || "";
		const status = { isFinished: false };
		this.registerSearchCancellation(ctx, traceId, status);

		try {
			const query = new URLSearchParams({ trace_id: traceId, keyword, engine });
			const raw = await this.httpClient.getJson<unknown>(
				`${baseUrl}/torrents/search?${query.toString()}`,
				{ ctx },
			);
			const result = z.array(SearchResultItemSchema).safeParse(raw);
			if (!result.success) {
				throw new Error("search_torrents API structure mismatch", {
					cause: result.error,
				});
			}
			return result.data;
		} finally {
			status.isFinished = true;
		}
	}

	async listTorrents(): Promise<TorrentStatusInfo[]> {
		const raw = await this.httpClient.getJson<unknown>(`${baseUrl}/torrents`);
		const result = z.array(TorrentStatusInfoSchema).safeParse(raw);
		if (!result.success) {
			throw new Error("torrent_list API structure mismatch", {
				cause: result.error,
			});
		}
		return result.data;
	}

	async pauseTorrent(infoHash: string): Promise<void> {
		await this.httpClient.request(`${baseUrl}/torrents/${infoHash}/pause`, {
			method: "POST",
		});
	}

	async resumeTorrent(infoHash: string): Promise<void> {
		await this.httpClient.request(`${baseUrl}/torrents/${infoHash}/resume`, {
			method: "POST",
		});
	}

	async deleteTorrent(infoHash: string, deleteFiles: boolean): Promise<void> {
		const query = new URLSearchParams({
			deleteFiles: deleteFiles.toString(),
		});
		await this.httpClient.request(
			`${baseUrl}/torrents/${infoHash}?${query.toString()}`,
			{
				method: "DELETE",
			},
		);
	}

	async addTorrentMagnet(magnet: string): Promise<AddTorrentResult> {
		const response = await this.httpClient.request(`${baseUrl}/torrents`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ magnet }),
		});
		const raw = await response.json();
		const result = AddTorrentResultSchema.safeParse(raw);
		if (!result.success) {
			throw new Error("torrent_add_magnet API structure mismatch", {
				cause: result.error,
			});
		}
		return result.data;
	}

	async getTorrentFiles(infoHash: string): Promise<FileDetails[]> {
		const raw = await this.httpClient.getJson<unknown>(
			`${baseUrl}/torrents/${infoHash}/files`,
		);
		const result = z.array(FileDetailsSchema).safeParse(raw);
		if (!result.success) {
			throw new Error("torrent_get_files API structure mismatch", {
				cause: result.error,
			});
		}
		return result.data;
	}

	async getTorrentStreamUrl(infoHash: string, fileId: number): Promise<string> {
		const response = await this.httpClient.request(
			`${baseUrl}/torrents/${infoHash}/files/${fileId}/stream-url`,
		);
		return response.text();
	}

	async getTorrentStatus(infoHash: string): Promise<TorrentStatusInfo> {
		const raw = await this.httpClient.getJson<unknown>(
			`${baseUrl}/torrents/${infoHash}/status`,
		);
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
		const raw = await this.httpClient.getJson<unknown>(
			`${baseUrl}/torrents/${infoHash}/files/${fileId}/subtitles`,
		);
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
		const response = await this.httpClient.request(
			`${baseUrl}/torrents/${infoHash}/files/${fileId}/subtitles/${trackId}`,
		);
		return response.text();
	}

	async subscribeTorrents(
		onUpdate: (torrents: TorrentStatusInfo[]) => void,
	): Promise<() => void> {
		const eventSource = new EventSource(`${baseUrl}/torrents/subscribe`);
		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				const result = z.array(TorrentStatusInfoSchema).safeParse(data);
				if (!result.success) {
					throw new Error("torrent_subscribe API structure mismatch", {
						cause: result.error,
					});
				}
				onUpdate(result.data);
			} catch (e) {
				throw new Error("Failed to parse SSE data", { cause: e });
			}
		};
		eventSource.onerror = (err) => {
			throw new Error("EventSource failed", { cause: err });
		};
		return () => {
			eventSource.close();
		};
	}
}

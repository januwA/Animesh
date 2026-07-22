import type { Context } from "ajanuw-context";
import type {
	AddTorrentResult,
	FileDetails,
	SearchResultItem,
	SubtitleTrackInfo,
	TorrentStatusInfo,
} from "./TorrentSchemas";

export interface TorrentRepository {
	search(
		ctx: Context,
		keyword: string,
		engine: string,
	): Promise<SearchResultItem[]>;
	listTorrents(): Promise<TorrentStatusInfo[]>;
	pauseTorrent(infoHash: string): Promise<void>;
	resumeTorrent(infoHash: string): Promise<void>;
	deleteTorrent(infoHash: string, deleteFiles: boolean): Promise<void>;
	addTorrentMagnet(ctx: Context, magnet: string): Promise<AddTorrentResult>;
	getTorrentFiles(infoHash: string): Promise<FileDetails[]>;
	getTorrentStreamUrl(infoHash: string, fileId: number): Promise<string>;
	getTorrentStatus(infoHash: string): Promise<TorrentStatusInfo>;
	getSubtitleTracks(
		infoHash: string,
		fileId: number,
	): Promise<SubtitleTrackInfo[]>;
	getSubtitleVtt(
		infoHash: string,
		fileId: number,
		trackId: number,
	): Promise<string>;
	subscribeTorrents(
		onUpdate: (torrents: TorrentStatusInfo[]) => void,
	): Promise<() => void>;
}

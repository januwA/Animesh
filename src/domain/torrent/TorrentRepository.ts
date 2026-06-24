import type {
	AddTorrentResult,
	FileDetails,
	SearchResultItem,
	TorrentStatusInfo,
} from "../../types";

export interface TorrentRepository {
	searchDmhy(keyword: string): Promise<SearchResultItem[]>;
	listTorrents(): Promise<TorrentStatusInfo[]>;
	pauseTorrent(infoHash: string): Promise<void>;
	resumeTorrent(infoHash: string): Promise<void>;
	deleteTorrent(infoHash: string, deleteFiles: boolean): Promise<void>;
	addTorrentMagnet(magnet: string): Promise<AddTorrentResult>;
	getTorrentFiles(infoHash: string): Promise<FileDetails[]>;
	getTorrentStreamUrl(infoHash: string, fileId: number): Promise<string>;
	getTorrentStatus(infoHash: string): Promise<TorrentStatusInfo>;
}

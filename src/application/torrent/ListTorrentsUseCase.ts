import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import type { TorrentStatusInfo } from "../../types";

export class ListTorrentsUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(): Promise<TorrentStatusInfo[]> {
		return this.torrentRepository.listTorrents();
	}
}

import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class ListTorrentsUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(): Promise<TorrentStatusInfo[]> {
		return this.torrentRepository.listTorrents();
	}
}

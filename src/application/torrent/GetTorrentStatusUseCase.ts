import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import type { TorrentStatusInfo } from "../../types";

export class GetTorrentStatusUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(infoHash: string): Promise<TorrentStatusInfo> {
		return this.torrentRepository.getTorrentStatus(infoHash);
	}
}

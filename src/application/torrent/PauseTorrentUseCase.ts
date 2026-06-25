import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class PauseTorrentUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(infoHash: string): Promise<void> {
		return this.torrentRepository.pauseTorrent(infoHash);
	}
}

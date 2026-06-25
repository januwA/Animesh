import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class ResumeTorrentUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(infoHash: string): Promise<void> {
		return this.torrentRepository.resumeTorrent(infoHash);
	}
}

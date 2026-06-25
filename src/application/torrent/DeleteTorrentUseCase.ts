import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class DeleteTorrentUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(infoHash: string, deleteFiles: boolean): Promise<void> {
		return this.torrentRepository.deleteTorrent(infoHash, deleteFiles);
	}
}

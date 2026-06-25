import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import type { FileDetails } from "../../types";

export class GetTorrentFilesUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(infoHash: string): Promise<FileDetails[]> {
		return this.torrentRepository.getTorrentFiles(infoHash);
	}
}

import type { FileDetails } from "@/domain/torrent/TorrentSchemas";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class GetTorrentFilesUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(infoHash: string): Promise<FileDetails[]> {
		return this.torrentRepository.getTorrentFiles(infoHash);
	}
}

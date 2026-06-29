import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class GetTorrentStatusUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(infoHash: string): Promise<TorrentStatusInfo> {
		return this.torrentRepository.getTorrentStatus(infoHash);
	}
}

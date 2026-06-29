import type { AddTorrentResult } from "@/domain/torrent/TorrentSchemas";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class AddTorrentMagnetUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(magnet: string): Promise<AddTorrentResult> {
		return this.torrentRepository.addTorrentMagnet(magnet);
	}
}

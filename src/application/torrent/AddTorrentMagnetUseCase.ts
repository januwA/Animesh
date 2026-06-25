import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import type { AddTorrentResult } from "../../types";

export class AddTorrentMagnetUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(magnet: string): Promise<AddTorrentResult> {
		return this.torrentRepository.addTorrentMagnet(magnet);
	}
}

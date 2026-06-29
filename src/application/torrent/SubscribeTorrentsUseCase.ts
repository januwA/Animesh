import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class SubscribeTorrentsUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(
		onUpdate: (torrents: TorrentStatusInfo[]) => void,
	): Promise<() => void> {
		return this.torrentRepository.subscribeTorrents(onUpdate);
	}
}

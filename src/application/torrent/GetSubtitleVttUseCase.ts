import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class GetSubtitleVttUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(infoHash: string, fileId: number, trackId: number): Promise<string> {
		return this.torrentRepository.getSubtitleVtt(infoHash, fileId, trackId);
	}
}

import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class GetSubtitleVttUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(dto: {
		infoHash: string;
		fileId: number;
		trackId: number;
	}): Promise<string> {
		return this.torrentRepository.getSubtitleVtt(
			dto.infoHash,
			dto.fileId,
			dto.trackId,
		);
	}
}

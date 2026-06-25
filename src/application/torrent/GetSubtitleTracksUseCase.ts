import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import type { SubtitleTrackInfo } from "../../types";

export class GetSubtitleTracksUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(infoHash: string, fileId: number): Promise<SubtitleTrackInfo[]> {
		return this.torrentRepository.getSubtitleTracks(infoHash, fileId);
	}
}

import type { SubtitleTrackInfo } from "@/domain/torrent/TorrentSchemas";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class GetSubtitleTracksUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(infoHash: string, fileId: number): Promise<SubtitleTrackInfo[]> {
		return this.torrentRepository.getSubtitleTracks(infoHash, fileId);
	}
}

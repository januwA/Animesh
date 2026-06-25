import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import type { SearchResultItem } from "../../types";

export class SearchTorrentsUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(keyword: string, engine: string): Promise<SearchResultItem[]> {
		return this.torrentRepository.search(keyword, engine);
	}
}

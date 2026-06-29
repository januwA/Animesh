import type { SearchResultItem } from "@/domain/torrent/TorrentSchemas";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class SearchTorrentsUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(keyword: string, engine: string): Promise<SearchResultItem[]> {
		return this.torrentRepository.search(keyword, engine);
	}
}

import type { SearchResultItem } from "@/domain/torrent/TorrentSchemas";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import type { Context } from "../../shared/context/interface";

export class SearchTorrentsUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(
		ctx: Context,
		keyword: string,
		engine: string,
	): Promise<SearchResultItem[]> {
		return this.torrentRepository.search(ctx, keyword, engine);
	}
}

import type { Context } from "ajanuw-context";
import type { SearchResultItem } from "@/domain/torrent/TorrentSchemas";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class SearchTorrentsUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	execute(
		ctx: Context,
		dto: { keyword: string; engine: string },
	): Promise<SearchResultItem[]> {
		return this.torrentRepository.search(ctx, dto.keyword, dto.engine);
	}
}

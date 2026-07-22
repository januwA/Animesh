import type { Context } from "ajanuw-context";
import type { BangumiCache } from "@/domain/bangumi/BangumiCache";
import type { BangumiEpisode } from "@/domain/bangumi/BangumiSchemas";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";

export class GetBangumiEpisodesUseCase {
	constructor(
		private readonly bangumiRepository: BangumiRepository,
		private readonly bangumiCache: BangumiCache,
	) {}

	async execute(ctx: Context, subjectId: string): Promise<BangumiEpisode[]> {
		const cached = await this.bangumiCache.getEpisodes(ctx, subjectId);
		if (cached) {
			return cached;
		}
		const episodes = await this.bangumiRepository.getEpisodes(ctx, subjectId);
		await this.bangumiCache.setEpisodes(ctx, subjectId, episodes);
		return episodes;
	}
}

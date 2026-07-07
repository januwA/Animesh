import type { Context } from "ajanuw-context";
import type { BangumiEpisode } from "@/domain/bangumi/BangumiSchemas";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";

export class GetBangumiEpisodesUseCase {
	constructor(private bangumiRepository: BangumiRepository) {}

	execute(ctx: Context, subjectId: string): Promise<BangumiEpisode[]> {
		return this.bangumiRepository.getEpisodes(ctx, subjectId);
	}
}

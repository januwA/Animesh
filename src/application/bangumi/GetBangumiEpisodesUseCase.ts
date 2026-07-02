import type { BangumiEpisode } from "@/domain/bangumi/BangumiSchemas";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";
import type { Context } from "../../shared/context/interface";

export class GetBangumiEpisodesUseCase {
	constructor(private bangumiRepository: BangumiRepository) {}

	execute(ctx: Context, subjectId: string): Promise<BangumiEpisode[]> {
		return this.bangumiRepository.getEpisodes(ctx, subjectId);
	}
}

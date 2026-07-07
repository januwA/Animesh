import type { BangumiEpisode } from "@/domain/bangumi/BangumiSchemas";
import type { Context } from "../../crosscutting/context/interface";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";

export class GetBangumiEpisodesUseCase {
	constructor(private bangumiRepository: BangumiRepository) {}

	execute(ctx: Context, subjectId: string): Promise<BangumiEpisode[]> {
		return this.bangumiRepository.getEpisodes(ctx, subjectId);
	}
}

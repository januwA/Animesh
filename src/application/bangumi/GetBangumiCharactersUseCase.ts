import type { Context } from "ajanuw-context";
import type { BangumiCache } from "@/domain/bangumi/BangumiCache";
import type { BangumiCharacter } from "@/domain/bangumi/BangumiSchemas";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";

export class GetBangumiCharactersUseCase {
	constructor(
		private readonly bangumiRepository: BangumiRepository,
		private readonly bangumiCache: BangumiCache,
	) {}

	async execute(ctx: Context, subjectId: string): Promise<BangumiCharacter[]> {
		const cached = await this.bangumiCache.getCharacters(ctx, subjectId);
		if (cached) {
			return cached;
		}
		const characters = await this.bangumiRepository.getSubjectCharacters(
			ctx,
			subjectId,
		);
		await this.bangumiCache.setCharacters(ctx, subjectId, characters);
		return characters;
	}
}

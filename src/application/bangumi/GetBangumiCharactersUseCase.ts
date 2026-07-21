import type { Context } from "ajanuw-context";
import type { BangumiCharacter } from "@/domain/bangumi/BangumiSchemas";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";

export class GetBangumiCharactersUseCase {
	constructor(private bangumiRepository: BangumiRepository) {}

	execute(ctx: Context, subjectId: string): Promise<BangumiCharacter[]> {
		return this.bangumiRepository.getSubjectCharacters(ctx, subjectId);
	}
}

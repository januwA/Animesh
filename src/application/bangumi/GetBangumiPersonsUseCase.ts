import type { Context } from "ajanuw-context";
import type { BangumiCache } from "@/domain/bangumi/BangumiCache";
import type { BangumiPerson } from "@/domain/bangumi/BangumiSchemas";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";

export class GetBangumiPersonsUseCase {
	constructor(
		private readonly bangumiRepository: BangumiRepository,
		private readonly bangumiCache: BangumiCache,
	) {}

	async execute(ctx: Context, subjectId: string): Promise<BangumiPerson[]> {
		const cached = await this.bangumiCache.getPersons(ctx, subjectId);
		if (cached) {
			return cached;
		}
		const persons = await this.bangumiRepository.getSubjectPersons(
			ctx,
			subjectId,
		);
		await this.bangumiCache.setPersons(ctx, subjectId, persons);
		return persons;
	}
}

import type { Context } from "ajanuw-context";
import type { BangumiPerson } from "@/domain/bangumi/BangumiSchemas";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";

export class GetBangumiPersonsUseCase {
	constructor(private bangumiRepository: BangumiRepository) {}

	execute(ctx: Context, subjectId: string): Promise<BangumiPerson[]> {
		return this.bangumiRepository.getSubjectPersons(ctx, subjectId);
	}
}

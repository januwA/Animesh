import type { Context } from "ajanuw-context";
import type { BangumiSubject } from "@/domain/bangumi/BangumiSchemas";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";

export class GetBangumiSubjectUseCase {
	constructor(private bangumiRepository: BangumiRepository) {}

	execute(ctx: Context, subjectId: string): Promise<BangumiSubject> {
		return this.bangumiRepository.getSubject(ctx, subjectId);
	}
}

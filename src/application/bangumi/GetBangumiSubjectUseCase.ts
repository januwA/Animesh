import type { BangumiSubject } from "@/domain/bangumi/BangumiSchemas";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";
import type { Context } from "../../shared/context/interface";

export class GetBangumiSubjectUseCase {
	constructor(private bangumiRepository: BangumiRepository) {}

	execute(ctx: Context, subjectId: string): Promise<BangumiSubject> {
		return this.bangumiRepository.getSubject(ctx, subjectId);
	}
}

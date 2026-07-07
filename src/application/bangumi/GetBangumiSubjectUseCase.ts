import type { BangumiSubject } from "@/domain/bangumi/BangumiSchemas";
import type { Context } from "../../crosscutting/context/interface";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";

export class GetBangumiSubjectUseCase {
	constructor(private bangumiRepository: BangumiRepository) {}

	execute(ctx: Context, subjectId: string): Promise<BangumiSubject> {
		return this.bangumiRepository.getSubject(ctx, subjectId);
	}
}

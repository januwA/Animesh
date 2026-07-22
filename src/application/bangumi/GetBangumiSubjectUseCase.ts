import type { Context } from "ajanuw-context";
import type { BangumiCache } from "@/domain/bangumi/BangumiCache";
import type { BangumiSubject } from "@/domain/bangumi/BangumiSchemas";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";

export class GetBangumiSubjectUseCase {
	constructor(
		private readonly bangumiRepository: BangumiRepository,
		private readonly bangumiCache: BangumiCache,
	) {}

	async execute(ctx: Context, subjectId: string): Promise<BangumiSubject> {
		const cached = await this.bangumiCache.getSubject(ctx, subjectId);
		if (cached) {
			return cached;
		}
		const subject = await this.bangumiRepository.getSubject(ctx, subjectId);
		await this.bangumiCache.setSubject(ctx, subjectId, subject);
		return subject;
	}
}

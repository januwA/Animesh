import type { Context } from "ajanuw-context";
import type { BangumiCache } from "@/domain/bangumi/BangumiCache";
import type { BangumiCalendarDay } from "@/domain/bangumi/BangumiSchemas";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";

export class GetBangumiCalendarUseCase {
	constructor(
		private readonly bangumiRepository: BangumiRepository,
		private readonly bangumiCache: BangumiCache,
	) {}

	async execute(ctx: Context): Promise<BangumiCalendarDay[]> {
		const cached = await this.bangumiCache.getCalendar(ctx);
		if (cached) {
			return cached;
		}
		const calendar = await this.bangumiRepository.getCalendar(ctx);
		await this.bangumiCache.setCalendar(ctx, calendar);
		return calendar;
	}
}

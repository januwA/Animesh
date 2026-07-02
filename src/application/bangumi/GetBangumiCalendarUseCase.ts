import type { BangumiCalendarDay } from "@/domain/bangumi/BangumiSchemas";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";
import type { Context } from "../../shared/context/interface";

export class GetBangumiCalendarUseCase {
	constructor(private bangumiRepository: BangumiRepository) {}

	execute(ctx: Context): Promise<BangumiCalendarDay[]> {
		return this.bangumiRepository.getCalendar(ctx);
	}
}

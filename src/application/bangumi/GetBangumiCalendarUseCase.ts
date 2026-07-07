import type { BangumiCalendarDay } from "@/domain/bangumi/BangumiSchemas";
import type { Context } from "../../crosscutting/context/interface";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";

export class GetBangumiCalendarUseCase {
	constructor(private bangumiRepository: BangumiRepository) {}

	execute(ctx: Context): Promise<BangumiCalendarDay[]> {
		return this.bangumiRepository.getCalendar(ctx);
	}
}

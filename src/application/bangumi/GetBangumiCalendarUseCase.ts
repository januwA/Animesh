import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";
import type { BangumiCalendarDay } from "../../types";

export class GetBangumiCalendarUseCase {
	constructor(private bangumiRepository: BangumiRepository) {}

	execute(): Promise<BangumiCalendarDay[]> {
		return this.bangumiRepository.getCalendar();
	}
}

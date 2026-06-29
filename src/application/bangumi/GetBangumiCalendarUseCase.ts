import type { BangumiCalendarDay } from "@/domain/bangumi/BangumiSchemas";
import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";

export class GetBangumiCalendarUseCase {
	constructor(private bangumiRepository: BangumiRepository) {}

	execute(): Promise<BangumiCalendarDay[]> {
		return this.bangumiRepository.getCalendar();
	}
}

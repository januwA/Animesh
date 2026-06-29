import type { BangumiCalendarDay } from "./BangumiSchemas";

export interface BangumiRepository {
	getCalendar(): Promise<BangumiCalendarDay[]>;
}

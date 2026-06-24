import type { BangumiCalendarDay } from "../../types";

export interface BangumiRepository {
	getCalendar(): Promise<BangumiCalendarDay[]>;
}

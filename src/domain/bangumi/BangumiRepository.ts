import type { Context } from "../../shared/context/interface";
import type { BangumiCalendarDay } from "./BangumiSchemas";

export interface BangumiRepository {
	getCalendar(ctx: Context): Promise<BangumiCalendarDay[]>;
}

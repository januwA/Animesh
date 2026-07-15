import type { Context } from "ajanuw-context";
import type { BangumiCalendarDay } from "./BangumiSchemas";

export interface BangumiCache {
	getCalendar(ctx: Context): Promise<BangumiCalendarDay[] | null>;
	setCalendar(ctx: Context, calendar: BangumiCalendarDay[]): Promise<void>;
}

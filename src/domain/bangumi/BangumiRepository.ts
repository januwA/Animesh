import type { Context } from "ajanuw-context";
import type {
	BangumiCalendarDay,
	BangumiEpisode,
	BangumiSubject,
} from "./BangumiSchemas";

export interface BangumiRepository {
	getCalendar(ctx: Context): Promise<BangumiCalendarDay[]>;
	getSubject(ctx: Context, subjectId: string): Promise<BangumiSubject>;
	getEpisodes(ctx: Context, subjectId: string): Promise<BangumiEpisode[]>;
}

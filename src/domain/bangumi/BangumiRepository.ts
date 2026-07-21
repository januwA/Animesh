import type { Context } from "ajanuw-context";
import type {
	BangumiCalendarDay,
	BangumiCharacter,
	BangumiEpisode,
	BangumiPerson,
	BangumiSubject,
} from "./BangumiSchemas";

export interface BangumiRepository {
	getCalendar(ctx: Context): Promise<BangumiCalendarDay[]>;
	getSubject(ctx: Context, subjectId: string): Promise<BangumiSubject>;
	getEpisodes(ctx: Context, subjectId: string): Promise<BangumiEpisode[]>;
	getSubjectPersons(ctx: Context, subjectId: string): Promise<BangumiPerson[]>;
	getSubjectCharacters(
		ctx: Context,
		subjectId: string,
	): Promise<BangumiCharacter[]>;
}

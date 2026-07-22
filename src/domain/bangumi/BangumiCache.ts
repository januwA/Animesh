import type { Context } from "ajanuw-context";
import type {
	BangumiCalendarDay,
	BangumiCharacter,
	BangumiEpisode,
	BangumiPerson,
	BangumiSubject,
} from "./BangumiSchemas";

export interface BangumiCache {
	getCalendar(ctx: Context): Promise<BangumiCalendarDay[] | null>;
	setCalendar(ctx: Context, calendar: BangumiCalendarDay[]): Promise<void>;

	getSubject(ctx: Context, subjectId: string): Promise<BangumiSubject | null>;
	setSubject(
		ctx: Context,
		subjectId: string,
		subject: BangumiSubject,
	): Promise<void>;

	getEpisodes(
		ctx: Context,
		subjectId: string,
	): Promise<BangumiEpisode[] | null>;
	setEpisodes(
		ctx: Context,
		subjectId: string,
		episodes: BangumiEpisode[],
	): Promise<void>;

	getPersons(ctx: Context, subjectId: string): Promise<BangumiPerson[] | null>;
	setPersons(
		ctx: Context,
		subjectId: string,
		persons: BangumiPerson[],
	): Promise<void>;

	getCharacters(
		ctx: Context,
		subjectId: string,
	): Promise<BangumiCharacter[] | null>;
	setCharacters(
		ctx: Context,
		subjectId: string,
		characters: BangumiCharacter[],
	): Promise<void>;
}

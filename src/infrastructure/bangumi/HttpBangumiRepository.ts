import type { BangumiRepository } from "../../domain/bangumi/BangumiRepository";
import type { BangumiCalendarDay } from "../../types";

const BANGUMI_CALENDAR_URL = "https://api.bgm.tv/calendar";

export class HttpBangumiRepository implements BangumiRepository {
	async getCalendar(): Promise<BangumiCalendarDay[]> {
		const response = await fetch(BANGUMI_CALENDAR_URL, {
			headers: {
				Accept: "application/json",
			},
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch calendar: ${response.status} ${response.statusText}`,
			);
		}

		return response.json();
	}
}

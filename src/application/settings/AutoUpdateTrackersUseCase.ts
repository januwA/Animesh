import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import type { Settings } from "../../domain/settings/SettingsSchemas";
import {
	getTrackerUrl,
	type TrackerCdnType,
	type TrackerSourceType,
} from "../../domain/settings/TrackerSettings";

export class AutoUpdateTrackersUseCase {
	constructor(private settingsRepository: SettingsRepository) {}

	private shouldUpdate(settings: Settings, now: number): boolean {
		const autoUpdate = settings.tracker_auto_update === true;
		if (!autoUpdate) return false;

		const lastUpdate = settings.tracker_last_update_time || 0;
		return now - lastUpdate >= 24 * 60 * 60 * 1000;
	}

	private async performTrackerUpdate(
		fetched: string[],
		sourceType: string,
		cdn: string,
		customUrl: string,
		now: number,
	): Promise<void> {
		await this.settingsRepository.setTrackers(fetched);
		await this.settingsRepository.setTrackerOptions({
			sourceType,
			cdn,
			customUrl,
			autoUpdate: true,
			lastUpdateTime: now,
		});
	}

	async execute(): Promise<number | null> {
		const settings = await this.settingsRepository.getSettings();
		if (!settings) return null;

		const now = Date.now();
		if (!this.shouldUpdate(settings, now)) {
			return null;
		}

		const sourceType = settings.tracker_source_type || "best";
		const cdn = settings.tracker_cdn || "jsdelivr";
		const customUrl = settings.tracker_custom_url || "";

		const url = getTrackerUrl(
			sourceType as TrackerSourceType,
			cdn as TrackerCdnType,
			customUrl,
		);
		if (!url) return null;

		const fetched = await this.settingsRepository.fetchTrackers(url);
		if (fetched.length === 0) return null;

		await this.performTrackerUpdate(fetched, sourceType, cdn, customUrl, now);
		return fetched.length;
	}
}

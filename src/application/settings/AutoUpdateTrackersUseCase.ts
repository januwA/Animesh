import type { SettingsRepository } from "../../domain/settings/SettingsRepository";
import {
	getTrackerUrl,
	type TrackerCdnType,
	type TrackerSourceType,
} from "../../domain/settings/TrackerSettings";

export class AutoUpdateTrackersUseCase {
	constructor(private settingsRepository: SettingsRepository) {}

	async execute(): Promise<number | null> {
		const settings = await this.settingsRepository.getSettings();
		if (!settings) return null;

		const autoUpdate = settings.tracker_auto_update === true;
		if (!autoUpdate) return null;

		const lastUpdate = settings.tracker_last_update_time || 0;
		const now = Date.now();

		// Check if 24 hours (86400000 ms) have passed since last update
		if (now - lastUpdate < 24 * 60 * 60 * 1000) {
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

		await this.settingsRepository.setTrackers(fetched);
		await this.settingsRepository.setTrackerOptions({
			sourceType,
			cdn,
			customUrl,
			autoUpdate: true,
			lastUpdateTime: now,
		});

		return fetched.length;
	}
}

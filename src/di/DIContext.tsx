import { createContext, useContext } from "react";
import type { BangumiRepository } from "../domain/bangumi/BangumiRepository";
import type { NotificationRepository } from "../domain/notification/NotificationRepository";
import type { SettingsRepository } from "../domain/settings/SettingsRepository";
import type { TorrentRepository } from "../domain/torrent/TorrentRepository";

import { HttpBangumiRepository } from "../infrastructure/bangumi/HttpBangumiRepository";
import { TauriNotificationRepository } from "../infrastructure/notification/TauriNotificationRepository";
import { TauriSettingsRepository } from "../infrastructure/settings/TauriSettingsRepository";
import { TauriTorrentRepository } from "../infrastructure/torrent/TauriTorrentRepository";

export interface DIContainer {
	torrentRepository: TorrentRepository;
	settingsRepository: SettingsRepository;
	bangumiRepository: BangumiRepository;
	notificationRepository: NotificationRepository;
}

export interface CreateContainerParams {
	torrentRepository: TorrentRepository;
	settingsRepository: SettingsRepository;
	bangumiRepository: BangumiRepository;
	notificationRepository?: NotificationRepository;
}

export function createDIContainer(params: CreateContainerParams): DIContainer {
	return {
		torrentRepository: params.torrentRepository,
		settingsRepository: params.settingsRepository,
		bangumiRepository: params.bangumiRepository,
		notificationRepository:
			params.notificationRepository || new TauriNotificationRepository(),
	};
}

let defaultContainerInstance: DIContainer | null = null;

export function createDefaultDIContainer(): DIContainer {
	if (!defaultContainerInstance) {
		defaultContainerInstance = createDIContainer({
			torrentRepository: new TauriTorrentRepository(),
			settingsRepository: new TauriSettingsRepository(),
			bangumiRepository: new HttpBangumiRepository(),
			notificationRepository: new TauriNotificationRepository(),
		});
	}
	return defaultContainerInstance;
}

const DIContext = createContext<DIContainer | null>(null);

export const DIProvider = DIContext.Provider;

export function useDI(): DIContainer {
	const container = useContext(DIContext);
	if (!container) {
		throw new Error(
			"DIContainer was not provided. Make sure to wrap components with <DIProvider>",
		);
	}
	return container;
}

import { createContext, useContext } from "react";
import type { SettingsRepository } from "../domain/settings/SettingsRepository";
import type { TorrentRepository } from "../domain/torrent/TorrentRepository";

import { TauriSettingsRepository } from "../infrastructure/settings/TauriSettingsRepository";
import { TauriTorrentRepository } from "../infrastructure/torrent/TauriTorrentRepository";

export interface DIContainer {
	torrentRepository: TorrentRepository;
	settingsRepository: SettingsRepository;
}

export function createDIContainer(params: {
	torrentRepository: TorrentRepository;
	settingsRepository: SettingsRepository;
}): DIContainer {
	return {
		torrentRepository: params.torrentRepository,
		settingsRepository: params.settingsRepository,
	};
}

let defaultContainerInstance: DIContainer | null = null;

export function createDefaultDIContainer(): DIContainer {
	if (!defaultContainerInstance) {
		defaultContainerInstance = createDIContainer({
			torrentRepository: new TauriTorrentRepository(),
			settingsRepository: new TauriSettingsRepository(),
		});
	}
	return defaultContainerInstance;
}

const DIContext = createContext<DIContainer | null>(null);

export const DIProvider = DIContext.Provider;

export function useDI(): DIContainer {
	const container = useContext(DIContext);
	if (!container) {
		return createDefaultDIContainer();
	}
	return container;
}

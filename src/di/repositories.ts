import { LocalStorageCollectionRepository } from "../infrastructure/collection/LocalStorageCollectionRepository";
import { TauriNotificationRepository } from "../infrastructure/notification/TauriNotificationRepository";
import { TauriOpenerRepository } from "../infrastructure/opener/TauriOpenerRepository";
import { TauriSettingsRepository } from "../infrastructure/settings/TauriSettingsRepository";
import { TauriTorrentRepository } from "../infrastructure/torrent/TauriTorrentRepository";
import { GithubUpdateRepository } from "../infrastructure/update/GithubUpdateRepository";

export const TorrentRepositoryImpl = TauriTorrentRepository;
export const SettingsRepositoryImpl = TauriSettingsRepository;
export const NotificationRepositoryImpl = TauriNotificationRepository;
export const OpenerRepositoryImpl = TauriOpenerRepository;
export const UpdateRepositoryImpl = GithubUpdateRepository;
export const CollectionRepositoryImpl = LocalStorageCollectionRepository;

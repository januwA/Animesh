import { LocalStorageCollectionRepository } from "../infrastructure/collection/LocalStorageCollectionRepository";
import { HttpIptvRepository } from "../infrastructure/iptv/HttpIptvRepository";
import { TauriIptvStreamUrlRepository } from "../infrastructure/iptv/TauriIptvStreamUrlRepository";
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
export const IptvRepositoryImpl = HttpIptvRepository;
export const IptvStreamUrlRepositoryImpl = TauriIptvStreamUrlRepository;

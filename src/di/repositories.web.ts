import { HttpCollectionRepository } from "../infrastructure/collection/HttpCollectionRepository";
import { HttpIptvRepository } from "../infrastructure/iptv/HttpIptvRepository";
import { WebIptvStreamUrlRepository } from "../infrastructure/iptv/WebIptvStreamUrlRepository";
import { WebNotificationRepository } from "../infrastructure/notification/WebNotificationRepository";
import { WebOpenerRepository } from "../infrastructure/opener/WebOpenerRepository";
import { HttpSettingsRepository } from "../infrastructure/settings/HttpSettingsRepository";
import { HttpTorrentRepository } from "../infrastructure/torrent/HttpTorrentRepository";
import { WebUpdateRepository } from "../infrastructure/update/WebUpdateRepository";

export const TorrentRepositoryImpl = HttpTorrentRepository;
export const SettingsRepositoryImpl = HttpSettingsRepository;
export const NotificationRepositoryImpl = WebNotificationRepository;
export const OpenerRepositoryImpl = WebOpenerRepository;
export const UpdateRepositoryImpl = WebUpdateRepository;
export const CollectionRepositoryImpl = HttpCollectionRepository;
export const IptvRepositoryImpl = HttpIptvRepository;
export const IptvStreamUrlRepositoryImpl = WebIptvStreamUrlRepository;

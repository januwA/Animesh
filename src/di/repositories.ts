import { HttpIptvRepository } from "../infrastructure/iptv/HttpIptvRepository";
import { TauriIptvStreamUrlRepository } from "../infrastructure/iptv/TauriIptvStreamUrlRepository";
import { TauriNotificationRepository } from "../infrastructure/notification/TauriNotificationRepository";
import { TauriOpenerRepository } from "../infrastructure/opener/TauriOpenerRepository";
import { GithubUpdateRepository } from "../infrastructure/update/GithubUpdateRepository";

export const NotificationRepositoryImpl = TauriNotificationRepository;
export const OpenerRepositoryImpl = TauriOpenerRepository;
export const UpdateRepositoryImpl = GithubUpdateRepository;
export const IptvRepositoryImpl = HttpIptvRepository;
export const IptvStreamUrlRepositoryImpl = TauriIptvStreamUrlRepository;

import { HttpIptvRepository } from "../infrastructure/iptv/HttpIptvRepository";
import { WebIptvStreamUrlRepository } from "../infrastructure/iptv/WebIptvStreamUrlRepository";
import { WebNotificationRepository } from "../infrastructure/notification/WebNotificationRepository";
import { WebOpenerRepository } from "../infrastructure/opener/WebOpenerRepository";
import { WebUpdateRepository } from "../infrastructure/update/WebUpdateRepository";

export const NotificationRepositoryImpl = WebNotificationRepository;
export const OpenerRepositoryImpl = WebOpenerRepository;
export const UpdateRepositoryImpl = WebUpdateRepository;
export const IptvRepositoryImpl = HttpIptvRepository;
export const IptvStreamUrlRepositoryImpl = WebIptvStreamUrlRepository;

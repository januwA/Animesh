import {
	isPermissionGranted,
	requestPermission,
	sendNotification,
} from "@tauri-apps/plugin-notification";
import type { NotificationRepository } from "../../domain/notification/NotificationRepository";

export class TauriNotificationRepository implements NotificationRepository {
	async requestPermission(): Promise<boolean> {
		const granted = await isPermissionGranted();
		if (granted) return true;
		const permission = await requestPermission();
		return permission === "granted";
	}

	async sendNotification(title: string, body: string): Promise<void> {
		sendNotification({ title, body });
	}
}

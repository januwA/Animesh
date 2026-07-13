import type { NotificationRepository } from "../../domain/notification/NotificationRepository";

export class WebNotificationRepository implements NotificationRepository {
	async requestPermission(): Promise<boolean> {
		if (typeof window === "undefined" || !("Notification" in window)) {
			return false;
		}
		if (Notification.permission === "granted") return true;
		const permission = await Notification.requestPermission();
		return permission === "granted";
	}

	async sendNotification(title: string, body: string): Promise<void> {
		if (
			typeof window !== "undefined" &&
			"Notification" in window &&
			Notification.permission === "granted"
		) {
			new Notification(title, { body });
		}
	}
}

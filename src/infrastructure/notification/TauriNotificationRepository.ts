import {
	isPermissionGranted,
	requestPermission,
	sendNotification,
} from "@tauri-apps/plugin-notification";
import type { NotificationRepository } from "../../domain/notification/NotificationRepository";

export class TauriNotificationRepository implements NotificationRepository {
	private isTauri(): boolean {
		return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
	}

	async requestPermission(): Promise<boolean> {
		if (!this.isTauri()) return false;
		try {
			const granted = await isPermissionGranted();
			if (granted) return true;
			const permission = await requestPermission();
			return permission === "granted";
		} catch (e) {
			console.error("Failed to request notification permission:", e);
			return false;
		}
	}

	async sendNotification(title: string, body: string): Promise<void> {
		if (!this.isTauri()) return;
		try {
			sendNotification({ title, body });
		} catch (e) {
			console.error("Failed to send notification:", e);
		}
	}
}

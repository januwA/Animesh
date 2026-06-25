export interface NotificationRepository {
	requestPermission(): Promise<boolean>;
	sendNotification(title: string, body: string): Promise<void>;
}

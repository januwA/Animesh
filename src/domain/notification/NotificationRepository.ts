import type { NonEmptyString } from "../common/NonEmptyString";

export interface NotificationRepository {
  requestPermission(): Promise<boolean>;
  sendNotification(title: NonEmptyString, body: NonEmptyString): Promise<void>;
}

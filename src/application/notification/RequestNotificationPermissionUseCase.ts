import type { NotificationRepository } from "../../domain/notification/NotificationRepository";

export class RequestNotificationPermissionUseCase {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(): Promise<boolean> {
    return this.notificationRepository.requestPermission();
  }
}

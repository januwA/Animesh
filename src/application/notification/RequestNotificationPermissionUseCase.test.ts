import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationRepository } from "../../domain/notification/NotificationRepository";
import { RequestNotificationPermissionUseCase } from "./RequestNotificationPermissionUseCase";

describe("RequestNotificationPermissionUseCase 请求通知权限业务编排", () => {
  let mockNotificationRepository: NotificationRepository;
  let useCase: RequestNotificationPermissionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationRepository = {
      requestPermission: vi.fn().mockResolvedValue(true),
      sendNotification: vi.fn().mockResolvedValue(undefined),
    };
    useCase = new RequestNotificationPermissionUseCase(
      mockNotificationRepository,
    );
  });

  it("应当调用通知仓库的 requestPermission 并返回授权结果", async () => {
    const result = await useCase.execute();
    expect(mockNotificationRepository.requestPermission).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("当用户拒绝授权时，应当返回 false", async () => {
    vi.mocked(mockNotificationRepository.requestPermission).mockResolvedValue(
      false,
    );
    const result = await useCase.execute();
    expect(result).toBe(false);
  });
});

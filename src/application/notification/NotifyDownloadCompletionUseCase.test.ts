import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import type { NotificationRepository } from "../../domain/notification/NotificationRepository";
import { NotifyDownloadCompletionUseCase } from "./NotifyDownloadCompletionUseCase";

describe("NotifyDownloadCompletionUseCase 下载完成通知业务编排", () => {
  let mockNotificationRepository: NotificationRepository;
  let useCase: NotifyDownloadCompletionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();

    mockNotificationRepository = {
      requestPermission: vi.fn().mockResolvedValue(true),
      sendNotification: vi.fn().mockResolvedValue(undefined),
    };

    useCase = new NotifyDownloadCompletionUseCase(mockNotificationRepository);
  });

  it("首次加载时，不应对现有的已完成下载触发通知", async () => {
    const torrents: TorrentStatusInfo[] = [
      {
        info_hash: NonEmptyStringSchema.parse("hash1"),
        name: NonEmptyStringSchema.parse("动漫1"),
        progress_bytes: 100,
        total_bytes: 100,
        finished: true,
        download_speed_bytes_per_sec: 0,
        upload_speed_bytes_per_sec: 0,
        paused: false,
        peers_connected: 0,
        peers_total: 0,
        trackers: [],
      },
    ];

    await useCase.execute(torrents);

    expect(mockNotificationRepository.sendNotification).not.toHaveBeenCalled();
  });

  it("在后续运行中，有新的完成下载应该触发系统通知", async () => {
    const torrent1: TorrentStatusInfo = {
      info_hash: NonEmptyStringSchema.parse("hash1"),
      name: NonEmptyStringSchema.parse("动漫1"),
      progress_bytes: 50,
      total_bytes: 100,
      finished: false,
      download_speed_bytes_per_sec: 10,
      upload_speed_bytes_per_sec: 10,
      paused: false,
      peers_connected: 1,
      peers_total: 1,
      trackers: [],
    };

    // 首次加载：下载中
    await useCase.execute([torrent1]);
    expect(mockNotificationRepository.sendNotification).not.toHaveBeenCalled();

    // 第二次加载：已完成
    await useCase.execute([
      { ...torrent1, finished: true, progress_bytes: 100 },
    ]);
    expect(mockNotificationRepository.sendNotification).toHaveBeenCalledWith(
      "下载完成",
      "《动漫1》 已下载完成！",
    );

    // 第三次加载：已完成（已通知过的不再通知）
    vi.mocked(mockNotificationRepository.sendNotification).mockClear();
    await useCase.execute([
      { ...torrent1, finished: true, progress_bytes: 100 },
    ]);
    expect(mockNotificationRepository.sendNotification).not.toHaveBeenCalled();
  });

  it("如果种子从完成变回未完成(重启下载)，应该重置已通知记录", async () => {
    const torrent1: TorrentStatusInfo = {
      info_hash: NonEmptyStringSchema.parse("hash1"),
      name: NonEmptyStringSchema.parse("动漫1"),
      progress_bytes: 100,
      total_bytes: 100,
      finished: true,
      download_speed_bytes_per_sec: 0,
      upload_speed_bytes_per_sec: 0,
      paused: false,
      peers_connected: 0,
      peers_total: 0,
      trackers: [],
    };

    // 首次加载：已完成
    await useCase.execute([torrent1]);
    expect(mockNotificationRepository.sendNotification).not.toHaveBeenCalled();

    // 第二次加载：变回下载中 → 重置记录
    await useCase.execute([
      { ...torrent1, finished: false, progress_bytes: 50 },
    ]);
    expect(mockNotificationRepository.sendNotification).not.toHaveBeenCalled();

    // 第三次加载：重新变回完成 → 再次触发通知
    await useCase.execute([
      { ...torrent1, finished: true, progress_bytes: 100 },
    ]);
    expect(mockNotificationRepository.sendNotification).toHaveBeenCalledWith(
      "下载完成",
      "《动漫1》 已下载完成！",
    );
  });
});

import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import type { NotificationRepository } from "../../domain/notification/NotificationRepository";

export class NotifyDownloadCompletionUseCase {
  private notifiedHashes: Set<string> = new Set();
  private isFirstRun = true;

  constructor(private notificationRepository: NotificationRepository) {}

  async execute(torrents: TorrentStatusInfo[]): Promise<void> {
    for (const torrent of torrents) {
      if (torrent.finished) {
        if (this.isFirstRun) {
          // 首次加载时将已完成的种子记录下来，避免重复通知旧数据
          this.notifiedHashes.add(torrent.info_hash);
        } else if (!this.notifiedHashes.has(torrent.info_hash)) {
          this.notifiedHashes.add(torrent.info_hash);
          // 触发系统通知
          await this.notificationRepository.sendNotification(
            NonEmptyStringSchema.parse("下载完成"),
            NonEmptyStringSchema.parse(
              `《${NonEmptyStringSchema.parse(torrent.name)}》 已下载完成！`,
            ),
          );
        }
      } else {
        // 如果种子被重启下载或删除，清除已通知记录
        if (this.notifiedHashes.has(torrent.info_hash)) {
          this.notifiedHashes.delete(torrent.info_hash);
        }
      }
    }
    this.isFirstRun = false;
  }
}

import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

/** 解除下载资源与条目的绑定。 */
export class ClearTorrentSubjectUseCase {
  constructor(private torrentRepository: TorrentRepository) {}

  execute(infoHash: string): Promise<void> {
    return this.torrentRepository.clearTorrentSubject(infoHash);
  }
}

import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

/** 解除下载资源与条目的绑定。 */
export class ClearTorrentSubjectUseCase {
  constructor(private torrentRepository: TorrentRepository) {}

  execute(infoHash: NonEmptyString, platform: AnimePlatform): Promise<void> {
    return this.torrentRepository.clearTorrentSubject(infoHash, platform);
  }
}

import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class ResumeTorrentUseCase {
  constructor(private torrentRepository: TorrentRepository) {}

  execute(infoHash: NonEmptyString): Promise<void> {
    return this.torrentRepository.resumeTorrent(infoHash);
  }
}

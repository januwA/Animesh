import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class GetTorrentTrackersUseCase {
  constructor(private torrentRepository: TorrentRepository) {}

  execute(infoHash: NonEmptyString): Promise<string[]> {
    return this.torrentRepository.getTrackers(infoHash);
  }
}

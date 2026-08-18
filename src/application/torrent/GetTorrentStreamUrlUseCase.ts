import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class GetTorrentStreamUrlUseCase {
  constructor(private torrentRepository: TorrentRepository) {}

  execute(infoHash: NonEmptyString, fileId: number): Promise<string> {
    return this.torrentRepository.getTorrentStreamUrl(infoHash, fileId);
  }
}

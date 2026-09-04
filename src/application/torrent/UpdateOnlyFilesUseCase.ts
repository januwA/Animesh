import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class UpdateOnlyFilesUseCase {
  constructor(private torrentRepository: TorrentRepository) {}

  execute(infoHash: NonEmptyString, onlyFiles: number[]): Promise<void> {
    return this.torrentRepository.updateOnlyFiles(infoHash, onlyFiles);
  }
}

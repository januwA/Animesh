import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { SubtitleTranslationRepository } from "../../domain/subtitle/SubtitleTranslationRepository";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class DeleteTorrentUseCase {
  constructor(
    private torrentRepository: TorrentRepository,
    private subtitleTranslationRepository: SubtitleTranslationRepository,
  ) {}

  async execute(infoHash: NonEmptyString, deleteFiles: boolean): Promise<void> {
    await this.subtitleTranslationRepository.deleteByInfoHash(infoHash);
    await this.torrentRepository.deleteTorrent(infoHash, deleteFiles);
  }
}

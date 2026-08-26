import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { VideoMetadata } from "@/domain/torrent/TorrentSchemas";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class GetVideoMetadataUseCase {
  constructor(private torrentRepository: TorrentRepository) {}

  execute(infoHash: NonEmptyString, fileId: number): Promise<VideoMetadata> {
    return this.torrentRepository.getVideoMetadata(infoHash, fileId);
  }
}

import type { ChapterInfo } from "@/domain/torrent/TorrentSchemas";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class GetVideoChaptersUseCase {
  constructor(private torrentRepository: TorrentRepository) {}

  execute(infoHash: string, fileId: number): Promise<ChapterInfo[]> {
    return this.torrentRepository.getVideoChapters(infoHash, fileId);
  }
}

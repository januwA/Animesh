import type { VideoInfo } from "@/domain/torrent/TorrentSchemas";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class GetVideoInfoUseCase {
  constructor(private torrentRepository: TorrentRepository) {}

  execute(infoHash: string, fileId: number): Promise<VideoInfo> {
    return this.torrentRepository.getVideoInfo(infoHash, fileId);
  }
}

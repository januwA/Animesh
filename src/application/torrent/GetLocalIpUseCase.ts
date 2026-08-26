import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class GetLocalIpUseCase {
  constructor(private torrentRepository: TorrentRepository) {}

  execute(): Promise<string> {
    return this.torrentRepository.getLocalIp();
  }
}

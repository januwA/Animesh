import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class GetStreamPortUseCase {
  constructor(private torrentRepository: TorrentRepository) {}

  execute(): Promise<number> {
    return this.torrentRepository.getStreamPort();
  }
}

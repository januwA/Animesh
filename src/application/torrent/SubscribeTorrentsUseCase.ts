import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export class SubscribeTorrentsUseCase {
  constructor(private torrentRepository: TorrentRepository) {}

  execute(): Promise<ReadableStream<TorrentStatusInfo[]>> {
    return this.torrentRepository.subscribeTorrents();
  }
}

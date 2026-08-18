import type { Context } from "ajanuw-context";
import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { AddTorrentResult } from "@/domain/torrent/TorrentSchemas";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export interface ResolveTorrentParams {
  magnet?: NonEmptyString;
  infoHash?: NonEmptyString;
  title: NonEmptyString;
}

export class ResolveTorrentUseCase {
  constructor(private torrentRepository: TorrentRepository) {}

  async execute(
    ctx: Context,
    params: ResolveTorrentParams,
  ): Promise<AddTorrentResult> {
    if (params.magnet) {
      return this.torrentRepository.addTorrentMagnet(ctx, params.magnet);
    }

    if (params.infoHash) {
      const files = await this.torrentRepository.getTorrentFiles(
        params.infoHash,
      );
      return {
        info_hash: params.infoHash,
        name: params.title,
        files,
      };
    }

    throw new Error("未提供有效的磁力链接或种子 Hash");
  }
}

import type { AddTorrentResult } from "@/domain/torrent/TorrentSchemas";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export interface ResolveTorrentParams {
	magnet?: string;
	infoHash?: string;
	title?: string;
}

export class ResolveTorrentUseCase {
	constructor(private torrentRepository: TorrentRepository) {}

	async execute(params: ResolveTorrentParams): Promise<AddTorrentResult> {
		const { magnet, infoHash, title } = params;

		if (magnet) {
			return this.torrentRepository.addTorrentMagnet(magnet);
		}

		if (infoHash) {
			const files = await this.torrentRepository.getTorrentFiles(infoHash);
			return {
				info_hash: infoHash,
				name: title || "已缓存种子",
				files,
			};
		}

		throw new Error("未提供有效的磁力链接或种子 Hash");
	}
}

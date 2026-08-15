import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export interface SetTorrentSubjectParams {
  infoHash: string;
  subjectId: number;
  subjectName: string;
}

/** 将下载资源绑定到 Bangumi 条目。 */
export class SetTorrentSubjectUseCase {
  constructor(private torrentRepository: TorrentRepository) {}

  execute(params: SetTorrentSubjectParams): Promise<void> {
    const { infoHash, subjectId, subjectName } = params;
    return this.torrentRepository.setTorrentSubject(
      infoHash,
      subjectId,
      subjectName,
    );
  }
}

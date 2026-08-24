import type { NonEmptyString } from "@/domain/common/NonEmptyString";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";

export interface SetTorrentSubjectParams {
  infoHash: NonEmptyString;
  subjectId: number;
  subjectName: NonEmptyString;
}

/** 将下载资源绑定到条目。 */
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

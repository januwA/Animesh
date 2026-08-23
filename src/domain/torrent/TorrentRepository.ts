import type { Context } from "ajanuw-context";
import type { NonEmptyString } from "../common/NonEmptyString";
import type { TorrentSearchEngine } from "./TorrentEngines";
import type {
  AddTorrentResult,
  FileDetails,
  SearchResultItem,
  TorrentStatusInfo,
  VideoMetadata,
} from "./TorrentSchemas";

export interface TorrentRepository {
  search(
    ctx: Context,
    keyword: NonEmptyString,
    engine: TorrentSearchEngine,
  ): Promise<SearchResultItem[]>;
  pauseTorrent(infoHash: NonEmptyString): Promise<void>;
  resumeTorrent(infoHash: NonEmptyString): Promise<void>;
  deleteTorrent(infoHash: NonEmptyString, deleteFiles: boolean): Promise<void>;
  addTorrentMagnet(
    ctx: Context,
    magnet: NonEmptyString,
  ): Promise<AddTorrentResult>;
  getTorrentFiles(infoHash: NonEmptyString): Promise<FileDetails[]>;
  getStreamPort(): Promise<number>;
  getLocalIp(): Promise<string>;
  getVideoMetadata(
    infoHash: NonEmptyString,
    fileId: number,
  ): Promise<VideoMetadata>;
  getSubtitleVtt(
    infoHash: NonEmptyString,
    fileId: number,
    trackId: number,
  ): Promise<string>;
  setTorrentSubject(
    infoHash: NonEmptyString,
    subject_id: number,
    subject_name: NonEmptyString,
  ): Promise<void>;
  clearTorrentSubject(infoHash: NonEmptyString): Promise<void>;
  subscribeTorrents(
    onUpdate: (torrents: TorrentStatusInfo[]) => void,
  ): Promise<() => void>;
}

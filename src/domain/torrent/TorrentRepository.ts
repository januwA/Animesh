import type { Context } from "ajanuw-context";
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
    keyword: string,
    engine: TorrentSearchEngine,
  ): Promise<SearchResultItem[]>;
  listTorrents(): Promise<TorrentStatusInfo[]>;
  pauseTorrent(infoHash: string): Promise<void>;
  resumeTorrent(infoHash: string): Promise<void>;
  deleteTorrent(infoHash: string, deleteFiles: boolean): Promise<void>;
  addTorrentMagnet(ctx: Context, magnet: string): Promise<AddTorrentResult>;
  getTorrentFiles(infoHash: string): Promise<FileDetails[]>;
  getTorrentStreamUrl(infoHash: string, fileId: number): Promise<string>;
  getTorrentStatus(infoHash: string): Promise<TorrentStatusInfo>;
  getVideoMetadata(infoHash: string, fileId: number): Promise<VideoMetadata>;
  getSubtitleVtt(
    infoHash: string,
    fileId: number,
    trackId: number,
  ): Promise<string>;
  setTorrentSubject(
    infoHash: string,
    subject_id: number,
    subject_name: string,
  ): Promise<void>;
  clearTorrentSubject(infoHash: string): Promise<void>;
  subscribeTorrents(
    onUpdate: (torrents: TorrentStatusInfo[]) => void,
  ): Promise<() => void>;
}

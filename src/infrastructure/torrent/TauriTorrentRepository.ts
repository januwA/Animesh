import { Channel, invoke } from "@tauri-apps/api/core";
import type { Context } from "ajanuw-context";
import { z } from "zod";
import type { TorrentSearchEngine } from "@/domain/torrent/TorrentEngines";
import { commands } from "@/generated/tauri-commands";
import type { TorrentRepository } from "../../domain/torrent/TorrentRepository";
import {
  type AddTorrentResult,
  AddTorrentResultSchema,
  type FileDetails,
  FileDetailsSchema,
  type SearchResultItem,
  SearchResultItemSchema,
  type TorrentStatusInfo,
  TorrentStatusInfoSchema,
  type VideoMetadata,
  VideoMetadataSchema,
} from "../../domain/torrent/TorrentSchemas";

export class TauriTorrentRepository implements TorrentRepository {
  async search(
    ctx: Context,
    keyword: string,
    engine: TorrentSearchEngine,
  ): Promise<SearchResultItem[]> {
    const traceId = ctx.value<string>("traceId") || "";
    let isFinished = false;
    ctx.done().then(() => {
      if (!isFinished) {
        invoke<void>(commands.cancel_search, { traceId }).catch(() => {});
      }
    });

    try {
      const raw = await invoke<unknown>(commands.search_torrents, {
        traceId,
        keyword,
        engine,
      });
      const result = z.array(SearchResultItemSchema).safeParse(raw);
      if (!result.success) {
        throw new Error("search_torrents API structure mismatch", {
          cause: result.error,
        });
      }
      return result.data;
    } finally {
      isFinished = true;
    }
  }

  async pauseTorrent(infoHash: string): Promise<void> {
    return invoke<void>(commands.torrent_pause, { infoHash });
  }

  async resumeTorrent(infoHash: string): Promise<void> {
    return invoke<void>(commands.torrent_resume, { infoHash });
  }

  async deleteTorrent(infoHash: string, deleteFiles: boolean): Promise<void> {
    return invoke<void>(commands.torrent_delete, { infoHash, deleteFiles });
  }

  async addTorrentMagnet(
    ctx: Context,
    magnet: string,
  ): Promise<AddTorrentResult> {
    const traceId = ctx.value<string>("traceId") || "";
    ctx.done().then(() => {
      invoke<void>(commands.cancel_add_magnet, { traceId });
    });

    const raw = await invoke<unknown>(commands.torrent_add_magnet, {
      traceId,
      magnet,
    });
    const result = AddTorrentResultSchema.safeParse(raw);
    if (!result.success) {
      throw new Error("torrent_add_magnet API structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  async getTorrentFiles(infoHash: string): Promise<FileDetails[]> {
    const raw = await invoke<unknown>(commands.torrent_get_files, { infoHash });
    const result = z.array(FileDetailsSchema).safeParse(raw);
    if (!result.success) {
      throw new Error("torrent_get_files API structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  async getTorrentStreamUrl(infoHash: string, fileId: number): Promise<string> {
    return invoke<string>(commands.torrent_get_stream_url, {
      infoHash,
      fileId,
    });
  }

  async getVideoMetadata(
    infoHash: string,
    fileId: number,
  ): Promise<VideoMetadata> {
    const raw = await invoke<unknown>(commands.torrent_get_video_metadata, {
      infoHash,
      fileId,
    });
    const result = VideoMetadataSchema.safeParse(raw);
    if (!result.success) {
      throw new Error("torrent_get_video_metadata API structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  async getSubtitleVtt(
    infoHash: string,
    fileId: number,
    trackId: number,
  ): Promise<string> {
    return invoke<string>(commands.torrent_get_subtitle_vtt, {
      infoHash,
      fileId,
      trackId,
    });
  }

  async setTorrentSubject(
    infoHash: string,
    subject_id: number,
    subject_name: string,
  ): Promise<void> {
    return invoke<void>(commands.torrent_set_subject, {
      infoHash,
      subjectId: subject_id,
      subjectName: subject_name,
    });
  }

  async clearTorrentSubject(infoHash: string): Promise<void> {
    return invoke<void>(commands.torrent_clear_subject, { infoHash });
  }

  async subscribeTorrents(
    onUpdate: (torrents: TorrentStatusInfo[]) => void,
  ): Promise<() => void> {
    const channel = new Channel<unknown>((data) => {
      const result = z.array(TorrentStatusInfoSchema).safeParse(data);
      if (!result.success) {
        throw new Error("torrent_subscribe API structure mismatch", {
          cause: result.error,
        });
      }
      onUpdate(result.data);
    });

    await invoke<void>(commands.torrent_subscribe, {
      onEvent: channel,
    });

    // 订阅贯穿整个应用生命周期，后端 loop 依赖 Channel 关闭自动退出，无需手动取消
    return () => {};
  }
}

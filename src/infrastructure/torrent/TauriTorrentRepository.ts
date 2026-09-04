import { Channel, invoke } from "@tauri-apps/api/core";
import type { Context } from "ajanuw-context";
import { Duration } from "ajanuw-duration";
import { z } from "zod";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import { TRACE_ID } from "@/domain/common/ContextKeys";
import type { HttpClient } from "@/domain/http/HttpClient";
import type { CacheStore } from "@/domain/storage/CacheStore";
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
import { Cached } from "../cache/CachedDecorator";

export class TauriTorrentRepository implements TorrentRepository {
  constructor(
    private readonly httpClient: HttpClient,
    /** @internal accessed by @Cached decorator */
    public readonly store: CacheStore,
  ) {}

  @Cached({
    ttl: new Duration({ minutes: 10 }),
  })
  async search(
    ctx: Context,
    keyword: string,
    engine: TorrentSearchEngine,
  ): Promise<SearchResultItem[]> {
    const port = await this.getStreamPort();
    const raw = await this.httpClient.getJson<unknown>(
      ctx,
      `http://127.0.0.1:${port}/torrent_search`,
      { params: { keyword, engine } },
    );
    const result = z.array(SearchResultItemSchema).safeParse(raw);
    if (!result.success) {
      throw new Error("torrent_search API structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
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
    const traceId = ctx.value<string>(TRACE_ID) || "";
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

  async getStreamPort(): Promise<number> {
    return invoke<number>(commands.get_stream_port);
  }

  async getLocalIp(): Promise<string> {
    return invoke<string>(commands.get_local_ip);
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
    platform: AnimePlatform,
    subject_name: string,
  ): Promise<void> {
    return invoke<void>(commands.torrent_set_subject, {
      infoHash,
      subjectId: subject_id,
      platform,
      subjectName: subject_name,
    });
  }

  async clearTorrentSubject(
    infoHash: string,
    platform: AnimePlatform,
  ): Promise<void> {
    return invoke<void>(commands.torrent_clear_subject, { infoHash, platform });
  }

  async subscribeTorrents(): Promise<ReadableStream<TorrentStatusInfo[]>> {
    const channel = new Channel<unknown>();

    await invoke<void>(commands.torrent_subscribe, {
      onEvent: channel,
    });

    return new ReadableStream<TorrentStatusInfo[]>({
      start(controller) {
        channel.onmessage = (data) => {
          const result = z.array(TorrentStatusInfoSchema).safeParse(data);
          if (!result.success) {
            controller.error(
              new Error("torrent_subscribe API structure mismatch", {
                cause: result.error,
              }),
            );
            return;
          }
          controller.enqueue(result.data);
        };
      },
    });
  }
}

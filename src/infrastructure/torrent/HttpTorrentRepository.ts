import type { Context } from "ajanuw-context";
import { z } from "zod";
import type { TorrentSearchEngine } from "@/domain/torrent/TorrentEngines";
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
import type { HttpClient } from "../http/HttpClient";

const baseUrl = import.meta.env.PROD
  ? "/api"
  : (import.meta.env.VITE_API_BASE_URL as string) || "/api";

export class HttpTorrentRepository implements TorrentRepository {
  constructor(private readonly httpClient: HttpClient) {}

  async search(
    ctx: Context,
    keyword: string,
    engine: TorrentSearchEngine,
  ): Promise<SearchResultItem[]> {
    const query = new URLSearchParams({ keyword, engine });
    const raw = await this.httpClient.getJson<unknown>(
      `${baseUrl}/torrents/search?${query.toString()}`,
      { ctx },
    );
    const result = z.array(SearchResultItemSchema).safeParse(raw);
    if (!result.success) {
      throw new Error("search_torrents API structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  async pauseTorrent(infoHash: string): Promise<void> {
    await this.httpClient.request(`${baseUrl}/torrents/${infoHash}/pause`, {
      method: "POST",
    });
  }

  async resumeTorrent(infoHash: string): Promise<void> {
    await this.httpClient.request(`${baseUrl}/torrents/${infoHash}/resume`, {
      method: "POST",
    });
  }

  async deleteTorrent(infoHash: string, deleteFiles: boolean): Promise<void> {
    const query = new URLSearchParams({
      deleteFiles: deleteFiles.toString(),
    });
    await this.httpClient.request(
      `${baseUrl}/torrents/${infoHash}?${query.toString()}`,
      {
        method: "DELETE",
      },
    );
  }

  async addTorrentMagnet(
    ctx: Context,
    magnet: string,
  ): Promise<AddTorrentResult> {
    const traceId = ctx.value<string>("traceId") || "";
    ctx.done().then(() => {
      this.httpClient.request(`${baseUrl}/torrents/add-magnet/${traceId}`, {
        method: "DELETE",
      });
    });

    const response = await this.httpClient.request(`${baseUrl}/torrents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ magnet, trace_id: traceId }),
    });
    const raw = await response.json();
    const result = AddTorrentResultSchema.safeParse(raw);
    if (!result.success) {
      throw new Error("torrent_add_magnet API structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  async getTorrentFiles(infoHash: string): Promise<FileDetails[]> {
    const raw = await this.httpClient.getJson<unknown>(
      `${baseUrl}/torrents/${infoHash}/files`,
    );
    const result = z.array(FileDetailsSchema).safeParse(raw);
    if (!result.success) {
      throw new Error("torrent_get_files API structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  async getStreamPort(): Promise<number> {
    const raw = await this.httpClient.getJson<unknown>(
      `${baseUrl}/stream-port`,
    );
    const result = z.object({ port: z.number() }).safeParse(raw);
    if (!result.success) {
      throw new Error("stream-port API structure mismatch", {
        cause: result.error,
      });
    }
    return result.data.port;
  }

  async getLocalIp(): Promise<string> {
    return window.location.hostname;
  }

  async getVideoMetadata(
    infoHash: string,
    fileId: number,
  ): Promise<VideoMetadata> {
    const raw = await this.httpClient.getJson<unknown>(
      `${baseUrl}/torrents/${infoHash}/files/${fileId}/metadata`,
    );
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
    const response = await this.httpClient.request(
      `${baseUrl}/torrents/${infoHash}/files/${fileId}/subtitles/${trackId}`,
    );
    return response.text();
  }

  async setTorrentSubject(
    infoHash: string,
    subject_id: number,
    subject_name: string,
  ): Promise<void> {
    await this.httpClient.request(`${baseUrl}/torrents/${infoHash}/subject`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subject_id, subject_name }),
    });
  }

  async clearTorrentSubject(infoHash: string): Promise<void> {
    await this.httpClient.request(`${baseUrl}/torrents/${infoHash}/subject`, {
      method: "DELETE",
    });
  }

  async subscribeTorrents(
    onUpdate: (torrents: TorrentStatusInfo[]) => void,
  ): Promise<() => void> {
    const eventSource = new EventSource(`${baseUrl}/torrents/subscribe`);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const result = z.array(TorrentStatusInfoSchema).safeParse(data);
        if (!result.success) {
          throw new Error("torrent_subscribe API structure mismatch", {
            cause: result.error,
          });
        }
        onUpdate(result.data);
      } catch (e) {
        throw new Error("Failed to parse SSE data", { cause: e });
      }
    };
    eventSource.onerror = (err) => {
      throw new Error("EventSource failed", { cause: err });
    };
    return () => {
      eventSource.close();
    };
  }
}

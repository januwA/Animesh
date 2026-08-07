import type {
  IptvStreamUrlRepository,
  ResolvedStreamUrl,
} from "@/domain/iptv/IptvStreamUrlRepository";

export class WebIptvStreamUrlRepository implements IptvStreamUrlRepository {
  async resolvePlayableStreamUrl(rawUrl: string): Promise<ResolvedStreamUrl> {
    return { url: rawUrl, kind: "unknown" };
  }
}

import type { Context } from "ajanuw-context";
import { Duration } from "ajanuw-duration";
import { parseM3u } from "../../domain/iptv/IptvPlaylistParser";
import type { IptvRepository } from "../../domain/iptv/IptvRepository";
import type { IptvChannel, IptvCountry } from "../../domain/iptv/IptvSchemas";
import { IptvCountriesResponseSchema } from "../../domain/iptv/IptvSchemas";
import { Cached } from "../cache/CachedDecorator";
import type { HttpClient } from "../http/HttpClient";
import type { CacheStore } from "../storage/CacheStore";

const COUNTRIES_URL = "https://iptv-org.github.io/api/countries.json";
const PLAYLIST_BASE_URL = "https://iptv-org.github.io/iptv/countries";

export class HttpIptvRepository implements IptvRepository {
  constructor(
    private readonly client: HttpClient,
    public readonly store: CacheStore,
  ) {}

  @Cached({
    ttl: new Duration({ days: 30 }),
    excludeArgs: [0],
  })
  async getCountries(ctx: Context): Promise<IptvCountry[]> {
    const data = await this.client.getJson<unknown>(COUNTRIES_URL, { ctx });
    const result = IptvCountriesResponseSchema.safeParse(data);
    if (!result.success) {
      throw new Error("IPTV countries response structure mismatch", {
        cause: result.error,
      });
    }
    return result.data;
  }

  @Cached({
    ttl: new Duration({ days: 7 }),
    excludeArgs: [0],
  })
  async getChannels(ctx: Context, countryCode: string): Promise<IptvChannel[]> {
    const response = await this.client.request(
      `${PLAYLIST_BASE_URL}/${countryCode.toLowerCase()}.m3u`,
      { ctx },
    );
    const text = await response.text();
    return parseM3u(text);
  }
}

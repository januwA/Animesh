import type { Context } from "ajanuw-context";
import type { IptvCache } from "@/domain/iptv/IptvCache";
import {
  type IptvChannel,
  IptvChannelsResponseSchema,
  IptvCountriesResponseSchema,
  type IptvCountry,
} from "@/domain/iptv/IptvSchemas";
import type { CacheStore } from "@/infrastructure/storage/CacheStore";

export class BrowserIptvCache implements IptvCache {
  private readonly countriesTtlMs = 30 * 24 * 60 * 60 * 1000; // 30 days
  private readonly channelsTtlMs = 12 * 60 * 60 * 1000; // 12 hours

  constructor(private readonly store: CacheStore) {}

  getCountries(_ctx: Context): Promise<IptvCountry[] | null> {
    return this.store.getItem("iptv:countries", IptvCountriesResponseSchema);
  }

  setCountries(_ctx: Context, countries: IptvCountry[]): Promise<void> {
    return this.store.setItem("iptv:countries", countries, this.countriesTtlMs);
  }

  getChannels(
    _ctx: Context,
    countryCode: string,
  ): Promise<IptvChannel[] | null> {
    return this.store.getItem(
      `iptv:channels:${countryCode.toLowerCase()}`,
      IptvChannelsResponseSchema,
    );
  }

  setChannels(
    _ctx: Context,
    countryCode: string,
    channels: IptvChannel[],
  ): Promise<void> {
    return this.store.setItem(
      `iptv:channels:${countryCode.toLowerCase()}`,
      channels,
      this.channelsTtlMs,
    );
  }
}

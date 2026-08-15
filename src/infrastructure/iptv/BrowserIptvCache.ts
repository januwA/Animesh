import type { Context } from "ajanuw-context";
import { Duration } from "ajanuw-duration";
import type { IptvCache } from "@/domain/iptv/IptvCache";
import {
  type IptvChannel,
  IptvChannelsResponseSchema,
  IptvCountriesResponseSchema,
  type IptvCountry,
} from "@/domain/iptv/IptvSchemas";
import type { CacheStore } from "@/infrastructure/storage/CacheStore";

export class BrowserIptvCache implements IptvCache {
  constructor(private readonly store: CacheStore) {}

  getCountries(_ctx: Context): Promise<IptvCountry[] | null> {
    return this.store.getItem("iptv:countries", IptvCountriesResponseSchema);
  }

  setCountries(_ctx: Context, countries: IptvCountry[]): Promise<void> {
    return this.store.setItem(
      "iptv:countries",
      countries,
      new Duration({ days: 30 }).inMilliseconds,
    );
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
      new Duration({ hours: 12 }).inMilliseconds,
    );
  }
}

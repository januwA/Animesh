import type { Context } from "ajanuw-context";
import type { IptvChannel, IptvCountry } from "./IptvSchemas";

export interface IptvCache {
  getCountries(ctx: Context): Promise<IptvCountry[] | null>;
  setCountries(ctx: Context, countries: IptvCountry[]): Promise<void>;
  getChannels(ctx: Context, countryCode: string): Promise<IptvChannel[] | null>;
  setChannels(
    ctx: Context,
    countryCode: string,
    channels: IptvChannel[],
  ): Promise<void>;
}

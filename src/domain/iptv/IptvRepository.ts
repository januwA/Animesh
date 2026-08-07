import type { Context } from "ajanuw-context";
import type { IptvChannel, IptvCountry } from "./IptvSchemas";

export interface IptvRepository {
  getCountries(ctx: Context): Promise<IptvCountry[]>;
  getChannels(ctx: Context, countryCode: string): Promise<IptvChannel[]>;
}

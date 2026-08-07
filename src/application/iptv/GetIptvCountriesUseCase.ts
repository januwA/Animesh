import type { Context } from "ajanuw-context";
import type { IptvCache } from "@/domain/iptv/IptvCache";
import type { IptvCountry } from "@/domain/iptv/IptvSchemas";
import type { IptvRepository } from "../../domain/iptv/IptvRepository";

export class GetIptvCountriesUseCase {
  constructor(
    private readonly iptvRepository: IptvRepository,
    private readonly iptvCache: IptvCache,
  ) {}

  async execute(ctx: Context): Promise<IptvCountry[]> {
    const cached = await this.iptvCache.getCountries(ctx);
    if (cached) {
      return cached;
    }
    const countries = await this.iptvRepository.getCountries(ctx);
    await this.iptvCache.setCountries(ctx, countries);
    return countries;
  }
}

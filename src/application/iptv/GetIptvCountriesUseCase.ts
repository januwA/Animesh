import type { Context } from "ajanuw-context";
import type { IptvCountry } from "@/domain/iptv/IptvSchemas";
import type { IptvRepository } from "../../domain/iptv/IptvRepository";

export class GetIptvCountriesUseCase {
  constructor(private readonly iptvRepository: IptvRepository) {}

  async execute(ctx: Context): Promise<IptvCountry[]> {
    const countries = await this.iptvRepository.getCountries(ctx);
    return countries;
  }
}

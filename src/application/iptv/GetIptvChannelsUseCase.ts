import type { Context } from "ajanuw-context";
import type { IptvCache } from "@/domain/iptv/IptvCache";
import type { IptvChannel } from "@/domain/iptv/IptvSchemas";
import type { IptvRepository } from "../../domain/iptv/IptvRepository";

export class GetIptvChannelsUseCase {
  constructor(
    private readonly iptvRepository: IptvRepository,
    private readonly iptvCache: IptvCache,
  ) {}

  async execute(ctx: Context, countryCode: string): Promise<IptvChannel[]> {
    const cached = await this.iptvCache.getChannels(ctx, countryCode);
    if (cached) {
      return cached;
    }
    const channels = await this.iptvRepository.getChannels(ctx, countryCode);
    await this.iptvCache.setChannels(ctx, countryCode, channels);
    return channels;
  }
}

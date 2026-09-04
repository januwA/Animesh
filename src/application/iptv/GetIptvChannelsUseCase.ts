import type { Context } from "ajanuw-context";
import type { IptvChannel } from "@/domain/iptv/IptvSchemas";
import type { IptvRepository } from "../../domain/iptv/IptvRepository";

export class GetIptvChannelsUseCase {
  constructor(private readonly iptvRepository: IptvRepository) {}

  async execute(ctx: Context, countryCode: string): Promise<IptvChannel[]> {
    const channels = await this.iptvRepository.getChannels(ctx, countryCode);
    return channels;
  }
}

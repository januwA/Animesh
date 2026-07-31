import type { IptvStreamUrlRepository } from "@/domain/iptv/IptvStreamUrlRepository";

export class WebIptvStreamUrlRepository implements IptvStreamUrlRepository {
	async resolvePlayableStreamUrl(rawUrl: string): Promise<string> {
		return rawUrl;
	}
}

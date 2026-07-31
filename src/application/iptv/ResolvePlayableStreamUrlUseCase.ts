import type { IptvStreamUrlRepository } from "../../domain/iptv/IptvStreamUrlRepository";

export class ResolvePlayableStreamUrlUseCase {
	constructor(
		private readonly iptvStreamUrlRepository: IptvStreamUrlRepository,
	) {}

	execute(rawUrl: string): Promise<string> {
		return this.iptvStreamUrlRepository.resolvePlayableStreamUrl(rawUrl);
	}
}

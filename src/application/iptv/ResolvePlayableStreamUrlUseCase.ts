import type {
	IptvStreamUrlRepository,
	ResolvedStreamUrl,
} from "../../domain/iptv/IptvStreamUrlRepository";

export class ResolvePlayableStreamUrlUseCase {
	constructor(
		private readonly iptvStreamUrlRepository: IptvStreamUrlRepository,
	) {}

	execute(rawUrl: string): Promise<ResolvedStreamUrl> {
		return this.iptvStreamUrlRepository.resolvePlayableStreamUrl(rawUrl);
	}
}

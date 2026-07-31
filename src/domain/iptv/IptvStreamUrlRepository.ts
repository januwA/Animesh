export interface IptvStreamUrlRepository {
	resolvePlayableStreamUrl(rawUrl: string): Promise<string>;
}

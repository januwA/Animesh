export type StreamKind = "hls" | "flv" | "unknown";

export interface ResolvedStreamUrl {
	url: string;
	kind: StreamKind;
}

export interface IptvStreamUrlRepository {
	resolvePlayableStreamUrl(rawUrl: string): Promise<ResolvedStreamUrl>;
}

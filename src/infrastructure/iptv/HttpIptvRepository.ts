import type { Context } from "ajanuw-context";
import { parseM3u } from "../../domain/iptv/IptvPlaylistParser";
import type { IptvRepository } from "../../domain/iptv/IptvRepository";
import type { IptvChannel, IptvCountry } from "../../domain/iptv/IptvSchemas";
import { IptvCountriesResponseSchema } from "../../domain/iptv/IptvSchemas";
import type { HttpClient } from "../http/HttpClient";

const COUNTRIES_URL = "https://iptv-org.github.io/api/countries.json";
const PLAYLIST_BASE_URL = "https://iptv-org.github.io/iptv/countries";

export class HttpIptvRepository implements IptvRepository {
	constructor(private readonly client: HttpClient) {}

	async getCountries(ctx: Context): Promise<IptvCountry[]> {
		let data: unknown;
		try {
			data = await this.client.getJson<unknown>(COUNTRIES_URL, { ctx });
		} catch (err: unknown) {
			if (ctx.err() && err === ctx.err()) {
				throw err;
			}
			throw new Error("Failed to fetch IPTV countries", { cause: err });
		}

		const result = IptvCountriesResponseSchema.safeParse(data);
		if (!result.success) {
			throw new Error("IPTV countries response structure mismatch", {
				cause: result.error,
			});
		}
		return result.data;
	}

	async getChannels(ctx: Context, countryCode: string): Promise<IptvChannel[]> {
		let text: string;
		try {
			const response = await this.client.request(
				`${PLAYLIST_BASE_URL}/${countryCode.toLowerCase()}.m3u`,
				{ ctx },
			);
			text = await response.text();
		} catch (err: unknown) {
			if (ctx.err() && err === ctx.err()) {
				throw err;
			}
			throw new Error("Failed to fetch IPTV channels", { cause: err });
		}

		return parseM3u(text);
	}
}

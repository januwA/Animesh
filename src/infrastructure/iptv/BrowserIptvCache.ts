import type { Context } from "ajanuw-context";
import { z } from "zod";
import type { IptvCache } from "@/domain/iptv/IptvCache";
import {
	type IptvChannel,
	IptvChannelsResponseSchema,
	IptvCountriesResponseSchema,
	type IptvCountry,
} from "@/domain/iptv/IptvSchemas";

const CacheEnvelopeSchema = z.object({
	data: z.unknown(),
	expiry: z.number(),
});

function getItem<T>(key: string, schema: z.ZodType<T>): T | null {
	try {
		const serialized = localStorage.getItem(key);
		if (!serialized) {
			return null;
		}

		const parsed: unknown = JSON.parse(serialized);
		const envelopeResult = CacheEnvelopeSchema.safeParse(parsed);
		if (!envelopeResult.success) {
			localStorage.removeItem(key);
			return null;
		}

		const { data, expiry } = envelopeResult.data;
		if (Date.now() > expiry) {
			localStorage.removeItem(key);
			return null;
		}

		const validationResult = schema.safeParse(data);
		if (!validationResult.success) {
			localStorage.removeItem(key);
			return null;
		}

		return validationResult.data;
	} catch {
		return null;
	}
}

function setItem<T>(key: string, data: T, ttlMs: number): void {
	const entry = {
		data,
		expiry: Date.now() + ttlMs,
	};
	localStorage.setItem(key, JSON.stringify(entry));
}

export class BrowserIptvCache implements IptvCache {
	private readonly countriesTtlMs = 30 * 24 * 60 * 60 * 1000; // 30 days
	private readonly channelsTtlMs = 12 * 60 * 60 * 1000; // 12 hours

	getCountries(_ctx: Context): Promise<IptvCountry[] | null> {
		return Promise.resolve(
			getItem("iptv:countries", IptvCountriesResponseSchema),
		);
	}

	setCountries(_ctx: Context, countries: IptvCountry[]): Promise<void> {
		setItem("iptv:countries", countries, this.countriesTtlMs);
		return Promise.resolve();
	}

	getChannels(
		_ctx: Context,
		countryCode: string,
	): Promise<IptvChannel[] | null> {
		return Promise.resolve(
			getItem(
				`iptv:channels:${countryCode.toLowerCase()}`,
				IptvChannelsResponseSchema,
			),
		);
	}

	setChannels(
		_ctx: Context,
		countryCode: string,
		channels: IptvChannel[],
	): Promise<void> {
		setItem(
			`iptv:channels:${countryCode.toLowerCase()}`,
			channels,
			this.channelsTtlMs,
		);
		return Promise.resolve();
	}
}

import type { Context } from "../../crosscutting/context/interface";

export interface HttpClientOptions extends RequestInit {
	ctx?: Context;
}

export class HttpClient {
	private readonly defaultHeaders: HeadersInit;

	constructor(defaults: { headers?: HeadersInit } = {}) {
		this.defaultHeaders = defaults.headers || {};
	}

	async request(
		url: string | URL,
		options: HttpClientOptions = {},
	): Promise<Response> {
		const { ctx, headers, ...restOptions } = options;
		const controller = new AbortController();

		if (ctx) {
			if (ctx.err()) {
				throw ctx.err();
			}
			ctx.done().then(() => {
				controller.abort(ctx.err() || undefined);
			});
		}

		const response = await fetch(url, {
			...restOptions,
			signal: controller.signal,
			headers: {
				...this.defaultHeaders,
				...headers,
			},
		});

		if (!response.ok) {
			throw new Error(
				`HTTP error! status: ${response.status} ${response.statusText}`,
			);
		}

		return response;
	}

	async getJson<T>(
		url: string | URL,
		options: HttpClientOptions = {},
	): Promise<T> {
		const response = await this.request(url, {
			...options,
			method: "GET",
			headers: {
				Accept: "application/json",
				...options.headers,
			},
		});
		return response.json() as Promise<T>;
	}
}

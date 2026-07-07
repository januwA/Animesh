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

		try {
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
		} catch (err: unknown) {
			// 如果由于 Context 被取消而导致请求中止，则优先抛出 Context 本身的错误
			if (ctx?.err() && err instanceof Error && err.name === "AbortError") {
				throw ctx.err();
			}
			throw err;
		}
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

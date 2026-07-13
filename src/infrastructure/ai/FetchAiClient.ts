import type { AiClient } from "../../domain/ai/AiClient";
import type { HttpClient } from "../http/HttpClient";

const baseUrl = import.meta.env.PROD
	? "/api"
	: (import.meta.env.VITE_API_BASE_URL as string) || "/api";

export class FetchAiClient implements AiClient {
	constructor(private readonly httpClient: HttpClient) {}

	async post(
		endpoint: string,
		apiKey: string,
		payload: unknown,
	): Promise<unknown> {
		const response = await this.httpClient.request(
			`${baseUrl}/ai/chat-request`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					endpoint,
					api_key: apiKey,
					body_json: JSON.stringify(payload),
				}),
			},
		);

		const text = await response.text();
		return JSON.parse(text);
	}
}

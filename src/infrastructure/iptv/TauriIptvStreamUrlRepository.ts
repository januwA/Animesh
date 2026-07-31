import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type { IptvStreamUrlRepository } from "@/domain/iptv/IptvStreamUrlRepository";

const ProxyBaseUrlSchema = z.string();

export class TauriIptvStreamUrlRepository implements IptvStreamUrlRepository {
	async resolvePlayableStreamUrl(rawUrl: string): Promise<string> {
		if (!/^https?:\/\//i.test(rawUrl)) {
			return rawUrl;
		}

		const raw = await invoke<unknown>("iptv_proxy_base_url");
		const result = ProxyBaseUrlSchema.safeParse(raw);
		if (!result.success) {
			throw new Error("iptv_proxy_base_url API structure mismatch", {
				cause: result.error,
			});
		}
		const base = result.data.replace(/\/+$/, "");
		return `${base}?url=${encodeURIComponent(rawUrl)}`;
	}
}

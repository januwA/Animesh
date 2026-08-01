import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type {
	IptvStreamUrlRepository,
	ResolvedStreamUrl,
} from "@/domain/iptv/IptvStreamUrlRepository";

const StreamKindSchema = z.enum(["hls", "flv", "unknown"]);

const ResolvedStreamSchema = z.object({
	proxy_url: z.string(),
	kind: StreamKindSchema,
});

export class TauriIptvStreamUrlRepository implements IptvStreamUrlRepository {
	async resolvePlayableStreamUrl(rawUrl: string): Promise<ResolvedStreamUrl> {
		if (!/^https?:\/\//i.test(rawUrl)) {
			return { url: rawUrl, kind: "unknown" };
		}

		const raw = await invoke<unknown>("iptv_resolve_stream", { rawUrl });
		const result = ResolvedStreamSchema.safeParse(raw);
		if (!result.success) {
			throw new Error("iptv_resolve_stream API structure mismatch", {
				cause: result.error,
			});
		}
		const base = result.data.proxy_url.replace(/\/+$/, "");
		return {
			url: `${base}?url=${encodeURIComponent(rawUrl)}`,
			kind: result.data.kind,
		};
	}
}

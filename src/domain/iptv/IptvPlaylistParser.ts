import type { IptvChannel } from "./IptvSchemas";

const EXTINF_LINE_PATTERN = /^#EXTINF:(-?\d+)\s*(.*)$/i;

function parseExtinfAttributes(attributePart: string): {
	tvgId: string | null;
	logo: string | null;
	category: string | null;
} {
	const tvgId = /tvg-id="([^"]*)"/i.exec(attributePart)?.[1] ?? null;
	const logo = /tvg-logo="([^"]*)"/i.exec(attributePart)?.[1] ?? null;
	const category = /group-title="([^"]*)"/i.exec(attributePart)?.[1] ?? null;
	return { tvgId, logo, category };
}

export function parseM3u(text: string): IptvChannel[] {
	const channels: IptvChannel[] = [];
	let pending: Omit<IptvChannel, "url"> | null = null;

	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) continue;

		if (line.startsWith("#EXTINF")) {
			const match = EXTINF_LINE_PATTERN.exec(line);
			const attributePart = match ? match[2] : line.slice("#EXTINF:".length);
			const lastCommaIndex = attributePart.lastIndexOf(",");
			const name =
				lastCommaIndex >= 0
					? attributePart.slice(lastCommaIndex + 1).trim()
					: attributePart.trim();
			const { tvgId, logo, category } = parseExtinfAttributes(attributePart);
			pending = { tvgId, name, logo, category };
			continue;
		}

		if (line.startsWith("#")) {
			continue;
		}

		if (pending) {
			channels.push({ ...pending, url: line });
			pending = null;
		}
	}

	return channels;
}

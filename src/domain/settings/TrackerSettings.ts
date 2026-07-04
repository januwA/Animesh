export type TrackerSourceType =
	| "best"
	| "all"
	| "best_ip"
	| "all_ip"
	| "custom";
export type TrackerCdnType = "github" | "jsdelivr" | "gitmirror" | "custom";

export const TRACKER_PRESETS: Record<
	Exclude<TrackerSourceType, "custom">,
	string
> = {
	best: "trackers_best.txt",
	all: "trackers_all.txt",
	best_ip: "trackers_best_ip.txt",
	all_ip: "trackers_all_ip.txt",
};

export const TRACKER_CDN_BASES: Record<
	Exclude<TrackerCdnType, "custom">,
	string
> = {
	github: "https://raw.githubusercontent.com/ngosang/trackerslist/master",
	jsdelivr: "https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master",
	gitmirror: "https://raw.gitmirror.com/ngosang/trackerslist/master",
};

export function getTrackerUrl(
	type: TrackerSourceType,
	cdn: TrackerCdnType,
	customUrl?: string,
): string {
	if (type === "custom" || cdn === "custom") {
		return customUrl || "";
	}
	const filename = TRACKER_PRESETS[type];
	const base = TRACKER_CDN_BASES[cdn];
	return `${base}/${filename}`;
}

export function parseTrackers(text: string): string[] {
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => {
			if (!line) return false;
			if (line.startsWith("#")) return false;
			return /^(udp|https?|wss?):\/\//i.test(line);
		});
}

export type TrackerSourceType =
  | "best"
  | "all"
  | "best_ip"
  | "all_ip"
  | "custom";

export const TRACKER_PRESETS: Record<
  Exclude<TrackerSourceType, "custom">,
  string
> = {
  best: "trackers_best.txt",
  all: "trackers_all.txt",
  best_ip: "trackers_best_ip.txt",
  all_ip: "trackers_all_ip.txt",
};

const GITHUB_CDN_BASE =
  "https://raw.githubusercontent.com/ngosang/trackerslist/master";

export function getTrackerUrl(
  type: TrackerSourceType,
  customUrl?: string,
): string {
  if (type === "custom") {
    return customUrl || "";
  }
  const filename = TRACKER_PRESETS[type];
  return `${GITHUB_CDN_BASE}/${filename}`;
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

import type { AnimePlatform } from "./domain/anime/AnimeSchemas";

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function formatLocalDate(
  dateInput: string | number | Date | null | undefined,
): string {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return String(dateInput);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24),
  );
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const timeStr = `${hours}:${minutes}:${seconds}`;
  if (diffDays === 0) {
    return `今天 ${timeStr}`;
  }
  if (diffDays === 1) {
    return `昨天 ${timeStr}`;
  }
  if (diffDays === 2) {
    return `前天 ${timeStr}`;
  }
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day} ${timeStr}`;
}

function padTimePart(n: number): string {
  return String(n).padStart(2, "0");
}

/** 将毫秒时长格式化为 HH:mm:ss（无效或负数输入归一化为 00:00:00） */
export function formatPlaybackTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${padTimePart(hours)}:${padTimePart(minutes)}:${padTimePart(
    seconds,
  )}`;
}

export function getSubjectExternalUrl(
  platform: AnimePlatform,
  subjectId: number,
): string {
  if (platform === "anilist") {
    return `https://anilist.co/anime/${subjectId}`;
  }
  return `https://bgm.tv/subject/${subjectId}`;
}

export function formatError(err: unknown): string {
  if (err instanceof Error) {
    const messages: string[] = [err.message];
    let currentCause = err.cause;
    const visited = new Set<unknown>();
    while (currentCause) {
      if (visited.has(currentCause)) {
        break;
      }
      visited.add(currentCause);
      if (currentCause instanceof Error) {
        messages.push(currentCause.message);
        /* v8 ignore next */
        currentCause = currentCause.cause;
      } else {
        messages.push(String(currentCause));
        break;
      }
    }
    return messages.join(" -> ");
  }
  return String(err);
}

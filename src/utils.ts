export function formatBytes(bytes: number | null | undefined): string {
	if (bytes === null || bytes === undefined || bytes === 0) return "未知大小";
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

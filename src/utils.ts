export function formatBytes(bytes: number | null | undefined): string {
	if (bytes === null || bytes === undefined || bytes === 0) return "未知大小";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function formatLocalDate(
	dateInput: string | number | null | undefined,
): string {
	if (!dateInput) return "";
	const date = new Date(dateInput);
	if (Number.isNaN(date.getTime())) {
		return String(dateInput);
	}
	const pad = (n: number) => String(n).padStart(2, "0");
	const year = date.getFullYear();
	const month = pad(date.getMonth() + 1);
	const day = pad(date.getDate());
	const hours = pad(date.getHours());
	const minutes = pad(date.getMinutes());
	const seconds = pad(date.getSeconds());
	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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

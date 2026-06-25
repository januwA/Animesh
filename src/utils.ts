export function formatBytes(bytes: number | null | undefined): string {
	if (bytes === null || bytes === undefined || bytes === 0) return "未知大小";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function formatLocalDate(dateStr: string): string {
	if (!dateStr) return "";
	const date = new Date(dateStr);
	if (Number.isNaN(date.getTime())) {
		return dateStr;
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

export function formatBytes(bytes: number | null | undefined): string {
	if (bytes === null || bytes === undefined || bytes === 0) return "未知大小";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

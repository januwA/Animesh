export enum LogLevel {
	DEBUG = "debug",
	INFO = "info",
	WARN = "warn",
	ERROR = "error",
}

/**
 * ILogger 定义了日志记录的契约。
 * 它是一个跨越所有层的横切关注点。
 */
export interface Logger {
	debug(message: string, ...args: unknown[]): void;
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, error?: Error | unknown, ...args: unknown[]): void;

	/**
	 * withCategory 创建一个带有特定类别前缀的子日志记录器。
	 */
	withCategory(category: string): Logger;
}

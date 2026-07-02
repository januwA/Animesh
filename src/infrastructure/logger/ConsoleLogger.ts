import { type Logger, LogLevel } from "@/domain/logger/logger";

const LogPriority: Record<LogLevel, number> = {
	[LogLevel.DEBUG]: 0,
	[LogLevel.INFO]: 1,
	[LogLevel.WARN]: 2,
	[LogLevel.ERROR]: 3,
};

const logConsole = globalThis.console;

export class ConsoleLogger implements Logger {
	constructor(
		private readonly category: string = "App",
		private readonly minLevel: LogLevel = LogLevel.DEBUG,
	) {}

	private getFormattedPrefix(level: string): string {
		const now = new Date();
		const tzOffset = now.getTimezoneOffset() * 60000;
		const localISOTime = new Date(now.getTime() - tzOffset)
			.toISOString()
			.slice(0, -1)
			.replace("T", " ");
		return `[${localISOTime}] [${level.toUpperCase()}] [${this.category}]`;
	}

	debug(message: string, ...args: unknown[]): void {
		if (LogPriority[this.minLevel] <= LogPriority[LogLevel.DEBUG]) {
			logConsole.debug(this.getFormattedPrefix("debug"), message, ...args);
		}
	}

	info(message: string, ...args: unknown[]): void {
		if (LogPriority[this.minLevel] <= LogPriority[LogLevel.INFO]) {
			logConsole.info(this.getFormattedPrefix("info"), message, ...args);
		}
	}

	warn(message: string, ...args: unknown[]): void {
		if (LogPriority[this.minLevel] <= LogPriority[LogLevel.WARN]) {
			logConsole.warn(this.getFormattedPrefix("warn"), message, ...args);
		}
	}

	error(message: string, error?: Error | unknown, ...args: unknown[]): void {
		if (LogPriority[this.minLevel] <= LogPriority[LogLevel.ERROR]) {
			logConsole.error(
				this.getFormattedPrefix("error"),
				message,
				error,
				...args,
			);
		}
	}

	withCategory(category: string): Logger {
		const newCategory =
			this.category === "App" ? category : `${this.category}:${category}`;
		return new ConsoleLogger(newCategory, this.minLevel);
	}
}

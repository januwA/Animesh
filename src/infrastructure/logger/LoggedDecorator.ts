import type { Logger } from "@/domain/logger/logger";

export interface LoggedOptions {
  /** 入口/出口日志级别，默认 "debug" */
  level?: "debug" | "info" | "warn" | "error";
  /** 按参数索引（从 0 开始）排除不记录的参数 */
  excludeArgs?: number[];
}

interface LogAwareInstance {
  logger?: Logger;
}

// biome-ignore lint/suspicious/noExplicitAny: TC39 decorator requires flexible typing to wrap any method signature
type AnyMethod = (...args: any[]) => Promise<any>;

export function Logged(options: LoggedOptions = {}) {
  return (
    value: AnyMethod,
    context: ClassMethodDecoratorContext<LogAwareInstance, AnyMethod>,
  ) => {
    const methodName = String(context.name);
    const logLevel = options.level ?? "debug";

    return async function (this: LogAwareInstance, ...args: unknown[]) {
      const logger = this.logger;
      if (!logger) {
        return value.call(this, ...args);
      }

      const opId = crypto.randomUUID().slice(0, 8);
      const className = this.constructor.name;
      const label = `${className}.${methodName}`;

      const filteredArgs = options.excludeArgs
        ? args.filter((_, i) => !options.excludeArgs?.includes(i))
        : args;
      logger[logLevel](`[${opId}] ${label}() called`, filteredArgs);

      const start = performance.now();
      try {
        const result = await value.call(this, ...args);
        const duration = performance.now() - start;
        logger[logLevel](
          `[${opId}] ${label}() → ${duration.toFixed(1)}ms`,
          result,
        );
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        logger.error(
          `[${opId}] ${label}() → error after ${duration.toFixed(1)}ms`,
          error,
        );
        throw error;
      }
    };
  };
}

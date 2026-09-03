import type { Context } from "ajanuw-context";
import { isContextLike, TRACE_ID } from "@/domain/common/ContextKeys";
import { type Logger, LogLevel } from "@/domain/logger/logger";

export interface LoggedOptions {
  /** 入口/出口日志级别，默认 LogLevel.DEBUG */
  level?: LogLevel;
  /** 按参数索引（从 0 开始）排除不记录的参数 */
  excludeArgs?: number[];
}

interface LogAwareInstance {
  logger?: Logger;
}

// biome-ignore lint/suspicious/noExplicitAny: TC39 decorator requires flexible typing to wrap any method signature
type AnyMethod = (...args: any[]) => any | Promise<any>;

export function Logged(options: LoggedOptions = {}) {
  return (
    value: AnyMethod,
    context: ClassMethodDecoratorContext<LogAwareInstance, AnyMethod>,
  ) => {
    const methodName = String(context.name);
    const logLevel = options.level ?? LogLevel.DEBUG;

    return function (this: LogAwareInstance, ...args: unknown[]) {
      const logger = this.logger;
      if (!logger) {
        return value.call(this, ...args);
      }

      const ctxIndex = args.findIndex(isContextLike);
      const traceId =
        ctxIndex !== -1
          ? (args[ctxIndex] as Context).value<string>(TRACE_ID)
          : undefined;
      const opId = traceId || crypto.randomUUID().slice(0, 8);
      const className = this.constructor.name;
      const label = `${className}.${methodName}`;

      const excluded = new Set(options.excludeArgs ?? []);
      if (ctxIndex !== -1) excluded.add(ctxIndex);
      const filteredArgs =
        excluded.size > 0 ? args.filter((_, i) => !excluded.has(i)) : args;
      logger[logLevel](`[${opId}] ${label}() called`, filteredArgs);

      const start = performance.now();
      try {
        const result = value.call(this, ...args);

        // 检测是否是 Promise（鸭子类型检测）
        if (
          result !== null &&
          typeof result === "object" &&
          typeof result.then === "function"
        ) {
          // 异步函数：使用 .then() 链式处理
          return result.then(
            (resolved: unknown) => {
              const duration = performance.now() - start;
              logger[logLevel](
                `[${opId}] ${label}() → ${duration.toFixed(1)}ms`,
                resolved,
              );
              return resolved;
            },
            (error: unknown) => {
              const duration = performance.now() - start;
              logger.error(
                `[${opId}] ${label}() → error after ${duration.toFixed(1)}ms`,
                error,
              );
              throw error;
            },
          );
        }

        // 同步函数：直接记录日志
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

import type { Context } from "ajanuw-context";
import { Background } from "ajanuw-context";
import type { Duration } from "ajanuw-duration";
import { z } from "zod";
import { isContextLike } from "@/domain/common/ContextKeys";
import type { CacheStore } from "@/domain/storage/CacheStore";
import { fnv1a32 } from "@/utils";

export interface CachedOptions {
  ttl: Duration;
  prefix?: string;
  excludeArgs?: number[];
  /** 缓存操作失败时是否静默处理，默认 false（向上抛出） */
  swallowErrors?: boolean;
}

interface CacheAwareInstance {
  store?: CacheStore;
}

// biome-ignore lint/suspicious/noExplicitAny: TC39 decorator requires flexible typing to wrap any method signature
type AnyMethod = (...args: any[]) => Promise<any>;

/**
 * 将参数训练到缓存 key 序列化前，把 Context 参数替换为稳定占位符。
 * Context 携带 traceId、取消信号等每次调用都不同的易变状态，若参与 hash
 * 会导致缓存 key 每次都不同而击穿缓存。其余参数（含对象）仍精确参与 hash。
 */
function sanitizeArgsForHash(args: unknown[]): unknown[] {
  return args.map((arg) => (isContextLike(arg) ? "[ctx]" : arg));
}

export function Cached(options: CachedOptions) {
  return (
    value: AnyMethod,
    context: ClassMethodDecoratorContext<CacheAwareInstance, AnyMethod>,
  ) => {
    const methodName = String(context.name);

    return async function (this: CacheAwareInstance, ...args: unknown[]) {
      const store = this.store;
      if (!store) {
        return value.call(this, ...args);
      }

      const ctx =
        (args.find(isContextLike) as Context | undefined) ?? Background;
      const className = this.constructor.name;
      const filteredArgs = options.excludeArgs
        ? args.filter((_, i) => !options.excludeArgs?.includes(i))
        : args;

      const argsHash = fnv1a32(
        JSON.stringify(sanitizeArgsForHash(filteredArgs)),
      );
      const key = options.prefix
        ? `${options.prefix}:${methodName}:${argsHash}`
        : fnv1a32(`${className}:${methodName}:${argsHash}`);

      let cached: unknown = null;
      try {
        cached = await store.getItem(ctx, key, z.unknown());
      } catch (e) {
        if (!options.swallowErrors) throw e;
      }
      if (cached !== null) {
        return cached;
      }

      const result = await value.call(this, ...args);
      try {
        await store.setItem(ctx, key, result, options.ttl.inMilliseconds);
      } catch (e) {
        if (!options.swallowErrors) throw e;
      }
      return result;
    };
  };
}

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

      const argsHash = fnv1a32(JSON.stringify(filteredArgs));
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

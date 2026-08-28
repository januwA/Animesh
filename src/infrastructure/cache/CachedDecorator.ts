import type { Duration } from "ajanuw-duration";
import { z } from "zod";
import { fnv1a32 } from "@/utils";
import type { CacheStore } from "../storage/CacheStore";

export interface CachedOptions {
  ttl: Duration;
  prefix?: string;
  excludeArgs?: number[];
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

      const className = this.constructor.name;
      const filteredArgs = options.excludeArgs
        ? args.filter((_, i) => !options.excludeArgs?.includes(i))
        : args;

      const argsHash = fnv1a32(JSON.stringify(filteredArgs));
      const key = options.prefix
        ? `${options.prefix}:${methodName}:${argsHash}`
        : fnv1a32(`${className}:${methodName}:${argsHash}`);

      const cached = await store.getItem(key, z.unknown());
      if (cached !== null) {
        return cached;
      }

      const result = await value.call(this, ...args);
      await store.setItem(key, result, options.ttl.inMilliseconds);
      return result;
    };
  };
}

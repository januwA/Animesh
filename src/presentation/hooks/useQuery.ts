import type { Context } from "ajanuw-context";
import {
  Background,
  Canceled,
  WithCancel,
  WithTimeout,
  WithValue,
} from "ajanuw-context";
import type { Duration } from "ajanuw-duration";
import type { DependencyList } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TRACE_ID } from "@/domain/common/ContextKeys";

export interface UseQueryOptions<T> {
  /** 是否启用请求，默认 true；为 false 时不会发起请求，loading 保持 false */
  enabled?: boolean;
  /** 请求超时时间，超时后 context 会被取消 */
  timeout?: Duration;
  /** 请求成功后的回调 */
  onSuccess?: (data: T) => void;
  /** 请求失败后的回调 */
  onError?: (error: Error) => void;
}

export interface UseQueryResult<T> {
  /** 请求结果，未请求完成时为 null */
  data: T | null;
  /** 是否正在请求中 */
  loading: boolean;
  /** 请求错误信息，无错误时为 null */
  error: Error | null;
  /** 手动重新发起请求 */
  refetch: () => void;
}

/**
 * 自动执行查询并管理 data / loading / error 状态的 hook。
 *
 * queryFn 接收一个可取消的 Context（来自 ajanuw-context），在依赖变化或
 * 组件卸载时会自动取消上一次未完成的请求，避免竞态条件与内存泄漏。
 *
 * @param queryFn 接收 Context 并返回 Promise 的查询函数
 * @param deps 依赖数组，任一依赖变化时自动重新发起请求
 * @param options 可选项（enabled / onSuccess / onError）
 */
export function useQuery<T>(
  queryFn: (ctx: Context) => Promise<T>,
  deps: DependencyList,
  options: UseQueryOptions<T> = {},
): UseQueryResult<T> {
  const { enabled = true, onSuccess, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  const queryFnRef = useRef(queryFn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const optionsRef = useRef(options);
  queryFnRef.current = queryFn;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  optionsRef.current = options;

  const refetch = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 依赖由调用方通过 deps 显式控制
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let active = true;
    const [rawCtx, cancel] = optionsRef.current.timeout
      ? WithTimeout(Background, optionsRef.current.timeout.inMilliseconds)
      : WithCancel(Background);
    const ctx = WithValue(rawCtx, TRACE_ID, crypto.randomUUID());
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await queryFnRef.current(ctx);
        if (!active || ctx.err() === Canceled) return;
        setData(result);
        setError(null);
        onSuccessRef.current?.(result);
      } catch (err: unknown) {
        if (!active || ctx.err() === Canceled) return;
        const wrapped = err instanceof Error ? err : new Error(String(err));
        setError(wrapped);
        onErrorRef.current?.(wrapped);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      cancel();
    };
  }, [enabled, version, ...deps]);

  return { data, loading, error, refetch };
}

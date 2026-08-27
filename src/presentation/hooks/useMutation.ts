import type { CancelFunc, Context } from "ajanuw-context";
import { Background, Canceled, WithCancel } from "ajanuw-context";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseMutationOptions<T, P> {
  /** 执行成功后的回调，接收返回数据与本次参数 */
  onSuccess?: (data: T, params: P) => void;
  /** 执行失败后的回调，接收错误与本次参数 */
  onError?: (error: Error, params: P) => void;
  /** 无论成功或失败都会执行的回调 */
  onSettled?: (data: T | null, error: Error | null, params: P) => void;
}

export interface UseMutationResult<T, P> {
  /** 最近一次执行成功的返回数据 */
  data: T | null;
  /** 是否有正在执行中的请求 */
  loading: boolean;
  /** 最近一次执行失败的错误，无错误时为 null */
  error: Error | null;
  /** 手动触发执行，返回本次执行的结果数据（被取消或失败时为 null） */
  execute: (params: P) => Promise<T | null>;
  /** 取消当前正在执行的请求，并清空 loading 状态（不会触发 onError） */
  cancel: () => void;
  /** 重置 data / loading / error 状态 */
  reset: () => void;
}

/**
 * 手动触发异步操作并管理 data / loading / error 状态的 hook。
 *
 * mutationFn 接收一个可取消的 Context（来自 ajanuw-context），
 * 每次 execute 会取消上一次未完成的请求，组件卸载时也会自动取消，
 * 避免竞态条件与内存泄漏。
 *
 * @param mutationFn 接收 Context 与参数并返回 Promise 的执行函数
 * @param options 可选项（onSuccess / onError / onSettled）
 */
export function useMutation<T, P = void>(
  mutationFn: (ctx: Context, params: P) => Promise<T>,
  options: UseMutationOptions<T, P> = {},
): UseMutationResult<T, P> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutationFnRef = useRef(mutationFn);
  const optionsRef = useRef(options);
  const activeCancelRef = useRef<CancelFunc | null>(null);
  mutationFnRef.current = mutationFn;
  optionsRef.current = options;

  const execute = useCallback((params: P): Promise<T | null> => {
    // 取消上一次未完成的请求
    activeCancelRef.current?.();
    activeCancelRef.current = null;

    const [ctx, cancel] = WithCancel(Background);
    activeCancelRef.current = cancel;

    setLoading(true);
    setError(null);

    return mutationFnRef.current(ctx, params).then(
      (result) => {
        if (ctx.err() === Canceled) return null;
        activeCancelRef.current = null;
        setData(result);
        setLoading(false);
        const { onSuccess, onSettled } = optionsRef.current;
        onSuccess?.(result, params);
        onSettled?.(result, null, params);
        return result;
      },
      (err: unknown) => {
        if (ctx.err() === Canceled) return null;
        activeCancelRef.current = null;
        const wrapped = err instanceof Error ? err : new Error(String(err));
        setError(wrapped);
        setLoading(false);
        const { onError, onSettled } = optionsRef.current;
        onError?.(wrapped, params);
        onSettled?.(null, wrapped, params);
        return null;
      },
    );
  }, []);

  const cancel = useCallback(() => {
    activeCancelRef.current?.();
    activeCancelRef.current = null;
    setLoading(false);
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      activeCancelRef.current?.();
    };
  }, []);

  return { data, loading, error, execute, cancel, reset };
}

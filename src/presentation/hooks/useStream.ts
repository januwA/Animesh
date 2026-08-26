import type { Context } from "ajanuw-context";
import { Background, WithCancel } from "ajanuw-context";
import type { DependencyList } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export type StreamStatus = "idle" | "connecting" | "open" | "closed";

export interface UseStreamOptions<T> {
  /** 是否启用连接，默认 true；为 false 时不会建立连接 */
  enabled?: boolean;
  /** 流建立连接后的回调 */
  onOpen?: () => void;
  /** 收到新数据的回调 */
  onData?: (data: T) => void;
  /** 流出错的回调 */
  onError?: (error: Error) => void;
  /** 流关闭后的回调 */
  onClose?: () => void;
}

export interface UseStreamResult<T> {
  /** 流的最新值，未收到数据时为 null */
  data: T | null;
  /** 流错误信息，无错误时为 null */
  error: Error | null;
  /** 连接状态 */
  status: StreamStatus;
  /** 手动关闭流 */
  close: () => void;
  /** 重新连接（关闭旧流，打开新流） */
  refetch: () => void;
}

/**
 * 订阅 ReadableStream 并管理 data / error / status 状态的 hook。
 *
 * streamFn 接收一个可取消的 Context（来自 ajanuw-context），在依赖变化或
 * 组件卸载时会自动关闭上一次流并重新建立连接，避免内存泄漏。
 *
 * @param streamFn 接收 Context 并返回 Promise<ReadableStream<T>> 的订阅函数
 * @param deps 依赖数组，任一依赖变化时自动重新连接
 * @param options 可选项（enabled / onOpen / onData / onError / onClose）
 */
export function useStream<T>(
  streamFn: (ctx: Context) => Promise<ReadableStream<T>>,
  deps: DependencyList,
  options: UseStreamOptions<T> = {},
): UseStreamResult<T> {
  const { enabled = true, onOpen, onData, onError, onClose } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<StreamStatus>(
    enabled ? "idle" : "closed",
  );
  const [version, setVersion] = useState(0);

  const streamFnRef = useRef(streamFn);
  const onOpenRef = useRef(onOpen);
  const onDataRef = useRef(onData);
  const onErrorRef = useRef(onError);
  const onCloseRef = useRef(onClose);
  streamFnRef.current = streamFn;
  onOpenRef.current = onOpen;
  onDataRef.current = onData;
  onErrorRef.current = onError;
  onCloseRef.current = onClose;

  const close = useCallback(() => {
    setStatus("closed");
  }, []);

  const refetch = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 依赖由调用方通过 deps 显式控制
  useEffect(() => {
    if (!enabled) {
      setStatus("closed");
      return;
    }

    let active = true;
    let reader: ReadableStreamDefaultReader<T> | null = null;
    const [ctx, cancel] = WithCancel(Background);

    setStatus("connecting");
    setError(null);

    (async () => {
      try {
        const stream = await streamFnRef.current(ctx);
        if (!active || ctx.err() !== null) {
          stream.cancel();
          return;
        }

        reader = stream.getReader();
        setStatus("open");
        onOpenRef.current?.();

        while (active) {
          let chunk: ReadableStreamReadResult<T>;
          try {
            chunk = await reader.read();
          } catch (err: unknown) {
            if (!active || ctx.err() !== null) return;
            const wrapped = err instanceof Error ? err : new Error(String(err));
            setError(wrapped);
            onErrorRef.current?.(wrapped);
            return;
          }
          if (chunk.done || !active || ctx.err() !== null) break;
          setData(chunk.value);
          onDataRef.current?.(chunk.value);
        }
      } catch (err: unknown) {
        if (!active || ctx.err() !== null) return;
        const wrapped = err instanceof Error ? err : new Error(String(err));
        setError(wrapped);
        onErrorRef.current?.(wrapped);
      } finally {
        if (active && ctx.err() === null) {
          reader?.cancel();
          setStatus("closed");
          onCloseRef.current?.();
        }
      }
    })();

    return () => {
      active = false;
      cancel();
      reader?.cancel();
    };
  }, [enabled, version, ...deps]);

  return { data, error, status, close, refetch };
}

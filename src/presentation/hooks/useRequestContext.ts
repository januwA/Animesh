import type { CancelFunc } from "ajanuw-context";
import { Background, WithCancel, WithValue } from "ajanuw-context";
import { useCallback, useEffect, useRef } from "react";

export function useRequestContext() {
	const activeCancelRef = useRef<CancelFunc | null>(null);

	const cancel = useCallback(() => {
		activeCancelRef.current?.();
		activeCancelRef.current = null;
	}, []);

	const createContext = useCallback(() => {
		// 取消上一次的请求
		activeCancelRef.current?.();

		const [cancelCtx, cancelFn] = WithCancel(Background);
		activeCancelRef.current = cancelFn;

		const traceId = crypto.randomUUID();
		const ctx = WithValue(cancelCtx, "traceId", traceId);

		return ctx;
	}, []);

	useEffect(() => {
		return () => {
			activeCancelRef.current?.();
		};
	}, []);

	return {
		createContext,
		cancel,
	};
}

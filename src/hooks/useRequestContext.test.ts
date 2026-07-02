import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Canceled } from "@/shared/context/interface";
import { useRequestContext } from "./useRequestContext";

describe("useRequestContext", () => {
	it("应该能生成带有 traceId 的 Context 且初始非取消状态", () => {
		const { result } = renderHook(() => useRequestContext());
		const ctx = result.current.createContext();

		expect(ctx).toBeDefined();
		expect(ctx.err()).toBeNull();
		expect(ctx.value("traceId")).toBeDefined();
		expect(typeof ctx.value("traceId")).toBe("string");
	});

	it("当多次调用 createContext 时，前一个 Context 应该自动被取消", () => {
		const { result } = renderHook(() => useRequestContext());
		const ctx1 = result.current.createContext();
		const ctx2 = result.current.createContext();

		expect(ctx1.err()).toBe(Canceled);
		expect(ctx2.err()).toBeNull();
		expect(ctx1.value("traceId")).not.toBe(ctx2.value("traceId"));
	});

	it("调用返回的 cancel 方法应取消当前活跃的 Context", () => {
		const { result } = renderHook(() => useRequestContext());
		const ctx = result.current.createContext();

		result.current.cancel();
		expect(ctx.err()).toBe(Canceled);
	});

	it("组件卸载时，当前活跃的 Context 应该被自动取消", () => {
		const { result, unmount } = renderHook(() => useRequestContext());
		const ctx = result.current.createContext();

		unmount();
		expect(ctx.err()).toBe(Canceled);
	});
});

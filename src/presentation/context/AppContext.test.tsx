import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppContextProvider, useAppContext } from "./AppContext";

describe("AppContext 状态上下文", () => {
	it("应该可以通过 showToast 显示默认的 info 提示类型并自动清除", () => {
		vi.useFakeTimers();
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<AppContextProvider>{children}</AppContextProvider>
		);
		const { result } = renderHook(() => useAppContext(), { wrapper });

		expect(result.current.toasts).toEqual([]);

		act(() => {
			result.current.showToast("一条默认消息");
		});

		expect(result.current.toasts.length).toBe(1);
		expect(result.current.toasts[0].text).toBe("一条默认消息");
		expect(result.current.toasts[0].type).toBe("info");

		act(() => {
			vi.advanceTimersByTime(3000);
		});

		expect(result.current.toasts).toEqual([]);
		vi.useRealTimers();
	});

	it("应该可以通过 showToast 显示不同类型的提示", () => {
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<AppContextProvider>{children}</AppContextProvider>
		);
		const { result } = renderHook(() => useAppContext(), { wrapper });

		act(() => {
			result.current.showToast("成功消息", "success");
			result.current.showToast("警告消息", "warning");
			result.current.showToast("错误消息", "error");
		});

		expect(result.current.toasts.length).toBe(3);
		expect(result.current.toasts[0].type).toBe("success");
		expect(result.current.toasts[1].type).toBe("warning");
		expect(result.current.toasts[2].type).toBe("error");
	});

	it("应该可以通过 showToast 显示不同类型的提示并设置自定义持续时间", () => {
		vi.useFakeTimers();
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<AppContextProvider>{children}</AppContextProvider>
		);
		const { result } = renderHook(() => useAppContext(), { wrapper });

		act(() => {
			result.current.showToast("提示消息", "success", 1000);
		});

		expect(result.current.toasts.length).toBe(1);
		expect(result.current.toasts[0].type).toBe("success");

		act(() => {
			vi.advanceTimersByTime(1000);
		});

		expect(result.current.toasts).toEqual([]);
		vi.useRealTimers();
	});

	it("应该支持传统只传递 duration 作为第二个参数的调用方式", () => {
		vi.useFakeTimers();
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<AppContextProvider>{children}</AppContextProvider>
		);
		const { result } = renderHook(() => useAppContext(), { wrapper });

		act(() => {
			result.current.showToast("传统消息", 1500);
		});

		expect(result.current.toasts.length).toBe(1);
		expect(result.current.toasts[0].type).toBe("info");

		act(() => {
			vi.advanceTimersByTime(1500);
		});

		expect(result.current.toasts).toEqual([]);
		vi.useRealTimers();
	});
});

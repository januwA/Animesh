import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

const CrashingComponent = () => {
	throw new Error("Test render error");
};

describe("ErrorBoundary 错误边界组件", () => {
	const originalLocation = window.location;

	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		Object.defineProperty(window, "location", {
			value: originalLocation,
			writable: true,
		});
	});

	it("当子组件没有错误时，应该正确渲染子组件", () => {
		render(
			<ErrorBoundary>
				<div>正常内容</div>
			</ErrorBoundary>,
		);

		expect(screen.getByText("正常内容")).toBeInTheDocument();
	});

	it("当子组件抛出错误时，应该捕获并渲染错误恢复界面", () => {
		render(
			<ErrorBoundary>
				<CrashingComponent />
			</ErrorBoundary>,
		);

		expect(screen.getByText("应用遇到致命错误")).toBeInTheDocument();
		expect(screen.getByText("Test render error")).toBeInTheDocument();
	});

	it("点击重新加载按钮时，应该触发页面刷新", () => {
		const reloadMock = vi.fn();
		Object.defineProperty(window, "location", {
			value: { reload: reloadMock },
			writable: true,
		});

		render(
			<ErrorBoundary>
				<CrashingComponent />
			</ErrorBoundary>,
		);

		const button = screen.getByRole("button", { name: "重新加载应用" });
		fireEvent.click(button);

		expect(reloadMock).toHaveBeenCalled();
	});

	it("当子组件抛出无消息的错误时，应该使用默认未知异常提示", () => {
		const SilentCrashingComponent = () => {
			throw new Error("");
		};
		render(
			<ErrorBoundary>
				<SilentCrashingComponent />
			</ErrorBoundary>,
		);

		expect(
			screen.getByText("程序发生未知异常，请重新启动或刷新"),
		).toBeInTheDocument();
	});
});

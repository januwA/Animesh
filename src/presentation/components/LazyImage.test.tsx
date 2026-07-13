import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LazyImage } from "./LazyImage";

// 用来手动触发 IntersectionObserver callback 的机制
let observerCallback: IntersectionObserverCallback | null = null;

class MockIntersectionObserver {
	constructor(callback: IntersectionObserverCallback) {
		observerCallback = callback;
	}
	observe = vi.fn();
	disconnect = vi.fn();
	unobserve = vi.fn();
}

describe("LazyImage 懒加载图片组件", () => {
	const originalIntersectionObserver = window.IntersectionObserver;

	beforeEach(() => {
		observerCallback = null;
		window.IntersectionObserver = MockIntersectionObserver as any;
	});

	afterEach(() => {
		window.IntersectionObserver = originalIntersectionObserver;
	});

	it("在未进入视口时，不应该渲染真正的 img 元素，但应该渲染占位符", () => {
		render(
			<LazyImage
				src="https://example.com/image1.jpg"
				alt="测试图片"
				placeholder={<div data-testid="placeholder">加载中</div>}
			/>,
		);

		// 不应该有 img 元素
		expect(screen.queryByAltText("测试图片")).not.toBeInTheDocument();
		// 应该有占位符
		expect(screen.getByTestId("placeholder")).toBeInTheDocument();
	});

	it("当进入视口时，应该开始渲染真正的 img 元素", () => {
		render(
			<LazyImage
				src="https://example.com/image2.jpg"
				alt="测试图片"
				placeholder={<div data-testid="placeholder">加载中</div>}
			/>,
		);

		// 手动模拟触发进入视口
		expect(observerCallback).not.toBeNull();
		act(() => {
			observerCallback!(
				[
					{
						isIntersecting: true,
						target: document.createElement("div"),
					} as unknown as IntersectionObserverEntry,
				],
				{} as IntersectionObserver,
			);
		});

		// 应该渲染真正的 img 元素
		const img = screen.getByAltText("测试图片");
		expect(img).toBeInTheDocument();
		expect(img).toHaveAttribute("src", "https://example.com/image2.jpg");
	});

	it("图片加载成功后，应该隐藏占位符", () => {
		render(
			<LazyImage
				src="https://example.com/image3.jpg"
				alt="测试图片"
				placeholder={<div data-testid="placeholder">加载中</div>}
			/>,
		);

		// 进入视口
		act(() => {
			observerCallback!(
				[
					{
						isIntersecting: true,
						target: document.createElement("div"),
					} as unknown as IntersectionObserverEntry,
				],
				{} as IntersectionObserver,
			);
		});

		const img = screen.getByAltText("测试图片");
		// 触发 onLoad
		act(() => {
			fireEvent.load(img);
		});

		// 占位符不应该再渲染
		expect(screen.queryByTestId("placeholder")).not.toBeInTheDocument();
	});

	it("图片加载失败时，应该展示错误占位符", () => {
		render(
			<LazyImage
				src="https://example.com/image4.jpg"
				alt="测试图片"
				placeholder={<div data-testid="placeholder">加载中</div>}
				fallback={<div data-testid="fallback">加载失败</div>}
			/>,
		);

		// 进入视口
		act(() => {
			observerCallback!(
				[
					{
						isIntersecting: true,
						target: document.createElement("div"),
					} as unknown as IntersectionObserverEntry,
				],
				{} as IntersectionObserver,
			);
		});

		const img = screen.getByAltText("测试图片");
		// 触发 onError
		act(() => {
			fireEvent.error(img);
		});

		// 占位符不应该渲染
		expect(screen.queryByTestId("placeholder")).not.toBeInTheDocument();
		// 错误占位符应该被渲染
		expect(screen.getByTestId("fallback")).toBeInTheDocument();
	});

	it("在不支持 IntersectionObserver 的环境下，应该立即渲染图片", () => {
		const originalIntersectionObserver = window.IntersectionObserver;
		Object.defineProperty(window, "IntersectionObserver", {
			writable: true,
			value: undefined,
		});

		render(
			<LazyImage src="https://example.com/no-io.jpg" alt="非观察者图片" />,
		);

		// 应该能直接在文档里找到该图片且 src 正确
		const img = screen.getByAltText("非观察者图片");
		expect(img).toBeInTheDocument();
		expect(img).toHaveAttribute("src", "https://example.com/no-io.jpg");

		// 还原 Mock
		Object.defineProperty(window, "IntersectionObserver", {
			writable: true,
			value: originalIntersectionObserver,
		});
	});

	it("当 isIntersecting 为 false 时，不应该开始加载图片", () => {
		render(
			<LazyImage
				src="https://example.com/not-intersecting.jpg"
				alt="非相交图片"
				placeholder={<div data-testid="placeholder">加载中</div>}
			/>,
		);

		act(() => {
			observerCallback!(
				[
					{
						isIntersecting: false,
						target: document.createElement("div"),
					} as unknown as IntersectionObserverEntry,
				],
				{} as IntersectionObserver,
			);
		});

		expect(screen.queryByAltText("非相交图片")).not.toBeInTheDocument();
	});

	it("图片加载失败且未提供 fallback 时，应该展示默认错误占位符", () => {
		render(
			<LazyImage
				src="https://example.com/image-error-default.jpg"
				alt="测试错误"
			/>,
		);

		act(() => {
			observerCallback!(
				[
					{
						isIntersecting: true,
						target: document.createElement("div"),
					} as unknown as IntersectionObserverEntry,
				],
				{} as IntersectionObserver,
			);
		});

		const img = screen.getByAltText("测试错误");
		act(() => {
			fireEvent.error(img);
		});

		expect(screen.getByText("加载失败")).toBeInTheDocument();
	});
});

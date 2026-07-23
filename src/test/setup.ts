import "@testing-library/jest-dom";
import { afterEach, vi } from "vitest";

// Mock fetch globally to prevent network calls in tests
globalThis.fetch = vi.fn().mockImplementation(() =>
	Promise.resolve(
		new Response(JSON.stringify([]), {
			status: 200,
			headers: { "content-type": "application/json" },
		}),
	),
);

// Mock sonner (Sonner) toast globally for all tests
vi.mock("sonner", () => ({
	Toaster: () => null,
	toast: Object.assign(vi.fn(), {
		success: vi.fn(),
		error: vi.fn(),
		warning: vi.fn(),
	}),
}));

// Mock ScrollRestoration to prevent useMatches error in tests using MemoryRouter
vi.mock("react-router-dom", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-router-dom")>();
	return {
		...actual,
		ScrollRestoration: () => null,
	};
});

// Mock CSS.supports to prevent JSDOM crash when initializing video.js components
if (typeof window !== "undefined") {
	if (typeof window.CSS === "undefined") {
		(window as any).CSS = {
			supports: () => false,
		};
	} else if (typeof window.CSS.supports === "undefined") {
		window.CSS.supports = () => false;
	}

	if (typeof window.ResizeObserver === "undefined") {
		(window as any).ResizeObserver = class {
			observe() {}
			unobserve() {}
			disconnect() {}
		};
	}

	if (typeof window.IntersectionObserver === "undefined") {
		(window as any).IntersectionObserver = class {
			observe() {}
			unobserve() {}
			disconnect() {}
		};
	}
}

// ── 将 console 警告/错误视为测试失败 ──────────────────────────────────────────
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// 不需要引发测试失败的模式（可忽略的第三方库警告）
const IGNORED_PATTERNS: (RegExp | string)[] = [];

function shouldIgnore(message: string): boolean {
	return IGNORED_PATTERNS.some((pattern) => {
		if (pattern instanceof RegExp) return pattern.test(message);
		return message.includes(pattern);
	});
}

const activeTestErrors: string[] = [];

console.error = (...args) => {
	originalConsoleError(...args);
	const message = args
		.map((arg) => (arg instanceof Error ? arg.stack : String(arg)))
		.join(" ");
	if (!shouldIgnore(message)) {
		activeTestErrors.push(`[console.error] ${message}`);
	}
};

console.warn = (...args) => {
	originalConsoleWarn(...args);
	const message = args
		.map((arg) => (arg instanceof Error ? arg.stack : String(arg)))
		.join(" ");
	if (!shouldIgnore(message)) {
		activeTestErrors.push(`[console.warn] ${message}`);
	}
};

afterEach(() => {
	if (activeTestErrors.length > 0) {
		const messages = activeTestErrors.join("\n\n");
		activeTestErrors.length = 0;
		throw new Error(`测试中检测到 console 错误/警告：\n\n${messages}`);
	}
});

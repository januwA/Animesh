import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock fetch globally to prevent network calls in tests
globalThis.fetch = vi.fn().mockImplementation(() =>
	Promise.resolve(
		new Response(JSON.stringify([]), {
			status: 200,
			headers: { "content-type": "application/json" },
		}),
	),
);

// Mock @tauri-apps/plugin-notification globally
vi.mock("@tauri-apps/plugin-notification", () => ({
	isPermissionGranted: vi.fn().mockResolvedValue(true),
	requestPermission: vi.fn().mockResolvedValue("granted"),
	sendNotification: vi.fn(),
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

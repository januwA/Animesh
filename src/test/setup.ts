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

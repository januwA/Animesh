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

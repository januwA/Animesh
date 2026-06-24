/// <reference types="vitest" />

import path from "node:path";
// @ts-expect-error type error without @types/node package
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},

	// Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
	//
	// 1. prevent Vite from obscuring rust errors
	clearScreen: false,
	// 2. tauri expects a fixed port, fail if that port is not available
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: "ws",
					host,
					port: 1421,
				}
			: undefined,
		watch: {
			// 3. tell Vite to ignore watching `src-tauri`
			ignored: ["**/src-tauri/**"],
		},
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: "./src/test/setup.ts",
		coverage: {
			provider: "v8",
			reporter: ["text"],
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/main.tsx",
				"src/test/**",
				"**/*.test.{ts,tsx}",
				"**/*.d.ts",
				"src/components/ui/**",
				"src/types.ts",
				"src/di/**",
				"src/domain/**",
				"src/infrastructure/**",
			],
			thresholds: {
				lines: 100,
				functions: 100,
				branches: 90,
				statements: 90,
			},
		},
	},
}));

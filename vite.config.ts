/// <reference types="vitest" />

import path from "node:path";
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	console.log(mode, process.env);

	const isWeb = mode === "web";

	return {
		plugins: [react(), process.env.VITEST !== "true" && tailwindcss()].filter(
			Boolean,
		),
		envPrefix: ["VITE_", "TAURI_ENV_*"],
		resolve: {
			alias: {
				"@/di/repositories": isWeb
					? path.resolve(__dirname, "./src/di/repositories.web.ts")
					: path.resolve(__dirname, "./src/di/repositories.ts"),
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
			environment: "happy-dom",
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
					"src/presentation/components/ui/**",
					"src/di/**",
					"src/domain/**",
					"src/infrastructure/**",
				],
				thresholds: {
					lines: 100,
					functions: 100,
					branches: 95,
					statements: 95,
				},
			},
		},
	};
});

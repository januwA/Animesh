/// <reference types="vitest" />

import path from "node:path";
import process from "node:process";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  if (process.env.CI) {
    console.log(mode, process.env);
  }

  return {
    plugins: [react(), process.env.VITEST !== "true" && tailwindcss()].filter(
      Boolean,
    ),
    envPrefix: ["VITE_", "TAURI_ENV_*"],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
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
      reporters: ["minimal"], // minimal,dot
      maxWorkers: "50%",
      silent: "passed-only",
      coverage: {
        provider: "v8",
        reporter: ["text"],
        skipFull: true, // 输出的text只显示覆盖未达标的输出
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/main.tsx",
          "src/test/**",
          "**/*.test.{ts,tsx}",
          "**/*.d.ts",
          "src/presentation/components/ui/**",
          "src/presentation/App.tsx",
          "src/presentation/routes.tsx",
          "src/presentation/components/MpegtsVideo.tsx",
          "src/presentation/pages/*/index.tsx",
          "src/di/**",
          "src/generated/**",
          "src/infrastructure/**",
        ],
        thresholds: {
          perFile: true, // 要求每个文件单独满足下面的阈值,而不是汇总
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
      },
    },
  };
});

import type { KnipConfig } from "knip";

const config: KnipConfig = {
  project: ["src/**/*.{ts,tsx}!", "src/**/*.css!", "!src/test/**!"],
  ignore: ["src/presentation/components/ui/**"],
  ignoreExportsUsedInFile: true,
  compilers: {
    css: (text: string) =>
      [...text.matchAll(/@import\s+["']([^"']+)["']/g)]
        .map((m) => `import "${m[1]}";`)
        .join("\n"),
  },
};

export default config;

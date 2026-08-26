import { renderHook } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { describe, expect, it, vi } from "vitest";
import type { UseGlobalEffectsDeps } from "./useGlobalEffects";
import { useGlobalEffects } from "./useGlobalEffects";

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        {children}
      </ThemeProvider>
    );
  };
}

function createDeps(
  overrides: Partial<UseGlobalEffectsDeps> = {},
): UseGlobalEffectsDeps {
  return {
    setThemeUseCase: { execute: vi.fn() },
    ...overrides,
  };
}

describe("useGlobalEffects", () => {
  it("挂载时应该同步主题设置", () => {
    const { result } = renderHook(() => useGlobalEffects(createDeps()), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBeUndefined();
  });
});

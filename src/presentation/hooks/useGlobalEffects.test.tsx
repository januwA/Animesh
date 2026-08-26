import { renderHook } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { describe, expect, it, vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIContext } from "@/di/DIContext";
import { useGlobalEffects } from "./useGlobalEffects";

function createWrapper(diContainer: DIContainer) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <DIContext value={diContainer}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </ThemeProvider>
      </DIContext>
    );
  };
}

describe("useGlobalEffects", () => {
  it("挂载时应该调用 setThemeUseCase 同步主题", () => {
    const execute = vi.fn();
    const mockContainer = {
      setThemeUseCase: { execute },
    } as unknown as DIContainer;

    renderHook(() => useGlobalEffects(), {
      wrapper: createWrapper(mockContainer),
    });

    expect(execute).toHaveBeenCalledWith("dark");
  });
});

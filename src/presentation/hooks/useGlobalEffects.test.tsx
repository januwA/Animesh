import { renderHook, waitFor } from "@testing-library/react";
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
    requestNotificationPermissionUseCase: { execute: vi.fn() },
    setThemeUseCase: { execute: vi.fn() },
    ...overrides,
  };
}

describe("useGlobalEffects", () => {
  it("挂载时应该请求系统通知权限", async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue(true);
    renderHook(
      () =>
        useGlobalEffects(
          createDeps({
            requestNotificationPermissionUseCase: {
              execute: mockRequestPermission,
            },
          }),
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalled();
    });
  });
});

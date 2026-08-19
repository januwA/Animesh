import { renderHook, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { describe, expect, it, vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import { TorrentStatusProvider } from "@/presentation/context/TorrentStatusContext";
import type { UseGlobalEffectsDeps } from "./useGlobalEffects";
import { useGlobalEffects } from "./useGlobalEffects";

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <DIProvider
          value={
            {
              subscribeTorrentsUseCase: {
                execute: vi
                  .fn()
                  .mockImplementation((onUpdate: (list: unknown[]) => void) => {
                    onUpdate([]);
                    return Promise.resolve(() => {});
                  }),
              },
            } as unknown as DIContainer
          }
        >
          <TorrentStatusProvider>{children}</TorrentStatusProvider>
        </DIProvider>
      </ThemeProvider>
    );
  };
}

function createDeps(
  overrides: Partial<UseGlobalEffectsDeps> = {},
): UseGlobalEffectsDeps {
  return {
    requestNotificationPermissionUseCase: { execute: vi.fn() },
    notifyDownloadCompletionUseCase: { execute: vi.fn() },
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

  it("当 isLoading 为 false 时应该执行下载完成监听", async () => {
    const mockExecute = vi.fn().mockResolvedValue(undefined);
    renderHook(
      () =>
        useGlobalEffects(
          createDeps({
            notifyDownloadCompletionUseCase: { execute: mockExecute },
          }),
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalled();
    });
  });
});

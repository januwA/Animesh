import { renderHook, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { DIProvider } from "@/di/DIContext";
import { TorrentStatusProvider } from "@/presentation/context/TorrentStatusContext";
import { createDIContainerForTest } from "@/test/test-utils";
import { useGlobalEffects } from "./useGlobalEffects";

function createWrapper(
	diOverrides: Parameters<typeof createDIContainerForTest>[0],
) {
	return function Wrapper({ children }: { children: React.ReactNode }) {
		return (
			<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
				<DIProvider value={createDIContainerForTest(diOverrides)}>
					<TorrentStatusProvider>
						<MemoryRouter>{children}</MemoryRouter>
					</TorrentStatusProvider>
				</DIProvider>
			</ThemeProvider>
		);
	};
}

describe("useGlobalEffects", () => {
	it("挂载时应该请求系统通知权限", async () => {
		const mockRequestPermission = vi.fn().mockResolvedValue(true);
		renderHook(() => useGlobalEffects(), {
			wrapper: createWrapper({
				notificationRepository: {
					requestPermission: mockRequestPermission,
					sendNotification: vi.fn(),
				},
			}),
		});

		await waitFor(() => {
			expect(mockRequestPermission).toHaveBeenCalled();
		});
	});

	it("当 isLoading 为 false 时应该执行下载完成监听", async () => {
		const mockExecute = vi.fn().mockResolvedValue(undefined);
		renderHook(() => useGlobalEffects(), {
			wrapper: createWrapper({
				notifyDownloadCompletionUseCase: { execute: mockExecute } as any,
				subscribeTorrentsUseCase: {
					execute: vi
						.fn()
						.mockImplementation((onUpdate: (list: unknown[]) => void) => {
							onUpdate([]);
							return Promise.resolve(() => {});
						}),
				} as any,
			}),
		});

		await waitFor(() => {
			expect(mockExecute).toHaveBeenCalled();
		});
	});

	it("当自动更新 Tracker 成功返回数量时应该弹出 Toast 提示", async () => {
		const mockAutoUpdateExecute = vi.fn().mockResolvedValue(5);
		renderHook(() => useGlobalEffects(), {
			wrapper: createWrapper({
				autoUpdateTrackersUseCase: { execute: mockAutoUpdateExecute } as any,
			}),
		});

		await waitFor(() => {
			expect(toast.success).toHaveBeenCalledWith(
				expect.stringContaining("自动更新 Tracker 列表成功，已同步"),
			);
		});
	});

	it("当自动更新 Tracker 发生异常时应该安全捕获不崩溃", async () => {
		const mockAutoUpdateExecute = vi
			.fn()
			.mockRejectedValue(new Error("Sync failed"));
		renderHook(() => useGlobalEffects(), {
			wrapper: createWrapper({
				autoUpdateTrackersUseCase: { execute: mockAutoUpdateExecute } as any,
			}),
		});

		await waitFor(() => {
			expect(mockAutoUpdateExecute).toHaveBeenCalled();
		});
	});
});

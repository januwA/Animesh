import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { DIProvider } from "@/di/DIContext";
import { createDIContainerForTest } from "@/test/test-utils";
import { AppContextProvider } from "../context/AppContext";
import { TorrentStatusProvider } from "../context/TorrentStatusContext";
import { AppHeader } from "./AppComponents";

describe("AppComponents 组件", () => {
	it("AppHeader 应该在 TorrentStatusProvider 下正确渲染", async () => {
		let resolveUnsubscribe: any;
		const unsubMock = vi.fn();
		const promise = new Promise<any>((resolve) => {
			resolveUnsubscribe = () => resolve(unsubMock);
		});

		const mockContainer = createDIContainerForTest({
			subscribeTorrentsUseCase: {
				execute: vi.fn().mockReturnValue(promise),
			} as any,
		});

		const { unmount } = render(
			<DIProvider value={mockContainer}>
				<TorrentStatusProvider>
					<AppContextProvider>
						<MemoryRouter>
							<AppHeader />
						</MemoryRouter>
					</AppContextProvider>
				</TorrentStatusProvider>
			</DIProvider>,
		);

		unmount();
		resolveUnsubscribe();

		await promise;
		expect(unsubMock).toHaveBeenCalled();
	});
});

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { DIProvider } from "@/di/DIContext";
import { createDIContainerForTest } from "@/test/test-utils";
import { AppContextProvider } from "../context/AppContext";
import { AppHeader, ToastContainer } from "./AppComponents";

describe("AppComponents 组件", () => {
	it("AppHeader 应该在未完成订阅时卸载并正确清理", async () => {
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
				<AppContextProvider>
					<MemoryRouter>
						<AppHeader />
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

		unmount();
		resolveUnsubscribe();

		await promise;
		expect(unsubMock).toHaveBeenCalled();
	});

	it("ToastContainer 应该能够渲染各种类型的提示，并在点击关闭时触发 onClose", () => {
		const handleClose = vi.fn();
		const mockToasts = [
			{ id: 1, text: "信息提示", type: "info" as const },
			{ id: 2, text: "成功提示", type: "success" as const },
			{ id: 3, text: "警告提示", type: "warning" as const },
			{ id: 4, text: "错误提示", type: "error" as const },
			{ id: 5, text: "未知提示", type: undefined as any }, // 用于触发第一个 fallback
			{ id: 6, text: "非法提示", type: "invalid" as any }, // 用于触发第二个 fallback
		];

		render(<ToastContainer toasts={mockToasts} onClose={handleClose} />);

		expect(screen.getByText("信息提示")).toBeInTheDocument();
		expect(screen.getByText("成功提示")).toBeInTheDocument();
		expect(screen.getByText("警告提示")).toBeInTheDocument();
		expect(screen.getByText("错误提示")).toBeInTheDocument();
		expect(screen.getByText("未知提示")).toBeInTheDocument();
		expect(screen.getByText("非法提示")).toBeInTheDocument();

		const closeButtons = screen.getAllByLabelText("关闭提示");
		expect(closeButtons.length).toBe(6);

		// 点击第一个 close button
		fireEvent.click(closeButtons[0]);
		expect(handleClose).toHaveBeenCalledWith(1);
	});
});

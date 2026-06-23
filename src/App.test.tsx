import { invoke } from "@tauri-apps/api/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import App from "./App";

vi.mock("@tauri-apps/api/core", () => ({
	invoke: vi.fn(),
}));

describe("App 组件", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("应该正确渲染欢迎文本", () => {
		render(<App />);
		const heading = screen.getByRole("heading", {
			name: /Welcome to Tauri \+ React/i,
		});
		expect(heading).toBeInTheDocument();
	});

	it("当输入名字并提交表单时，应该正确调用 greet 并渲染返回的问候消息", async () => {
		const mockGreetResponse = "Hello, Bob! You've been greeted from Rust!";
		vi.mocked(invoke).mockResolvedValue(mockGreetResponse);

		render(<App />);

		const input = screen.getByPlaceholderText("Enter a name...");
		const button = screen.getByRole("button", { name: "Greet" });

		// 输入名字
		fireEvent.change(input, { target: { value: "Bob" } });
		expect(input).toHaveValue("Bob");

		// 提交表单
		fireEvent.click(button);

		// 校验 invoke 的调用情况
		expect(invoke).toHaveBeenCalledWith("greet", { name: "Bob" });

		// 校验渲染返回的问候文本
		await waitFor(() => {
			expect(screen.getByText(mockGreetResponse)).toBeInTheDocument();
		});
	});
});

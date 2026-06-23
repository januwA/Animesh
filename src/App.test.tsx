import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App 组件", () => {
	it("应该正确渲染欢迎文本", () => {
		render(<App />);
		const heading = screen.getByRole("heading", {
			name: /Welcome to Tauri \+ React/i,
		});
		expect(heading).toBeInTheDocument();
	});
});

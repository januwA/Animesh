import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { InvalidParamsView } from "./InvalidParamsView";

const schema = z.object({
	id: z.string().min(1, "缺少 id 参数"),
	flag: z.number({ message: "flag 必须是数字" }),
});

function makeError(): z.ZodError {
	return schema.safeParse({ id: "", flag: "abc" }).error!;
}

describe("InvalidParamsView 参数错误视图", () => {
	let router: ReturnType<typeof createMemoryRouter>;
	const Home = () => <div>Home</div>;
	const InvalidView = () => (
		<InvalidParamsView title="无效的路由参数" error={makeError()} />
	);

	const routes = (path: string) => [
		{
			path,
			element: <InvalidView />,
		},
		{
			path: "/home",
			element: <Home />,
		},
	];

	function renderAt(initialEntries: string[]) {
		router = createMemoryRouter(routes("/invalid"), { initialEntries });
		return render(<RouterProvider router={router} />);
	}

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("应该渲染标题与每条参数错误消息", () => {
		renderAt(["/invalid"]);
		expect(screen.getByText("无效的路由参数")).toBeInTheDocument();
		expect(screen.getByText("缺少 id 参数")).toBeInTheDocument();
		expect(screen.getByText("flag 必须是数字")).toBeInTheDocument();
	});

	it("点击返回按钮应该回退到上一页", () => {
		renderAt(["/home", "/invalid"]);
		fireEvent.click(screen.getByRole("button", { name: "返回" }));
		expect(screen.getByText("Home")).toBeInTheDocument();
	});
});

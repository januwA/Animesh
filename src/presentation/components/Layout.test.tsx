import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { DetailLayout, MainLayout, NavBarLayout } from "./Layout";

const mockDeps = {
  setThemeUseCase: { execute: vi.fn() },
};

function renderMainLayout(children: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<MainLayout globalEffectsDeps={mockDeps} />}>
          <Route index element={children} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("Layout 布局组件", () => {
  it("NavBarLayout 应该渲染导航栏与路由内容", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<NavBarLayout />}>
            <Route index element={<div>页面内容</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("页面内容")).toBeInTheDocument();
    expect(screen.getByTestId("app-navbar")).toBeInTheDocument();
  });

  it("MainLayout 应该渲染路由视图", async () => {
    renderMainLayout(<div>首页内容</div>);
    expect(await screen.findByText("首页内容")).toBeInTheDocument();
  });

  it("DetailLayout 应该渲染返回按钮与子路由内容", () => {
    render(
      <MemoryRouter initialEntries={["/detail"]}>
        <Routes>
          <Route element={<DetailLayout />}>
            <Route path="detail" element={<div>详情内容</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("详情内容")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /返回/ })).toBeInTheDocument();
  });
});

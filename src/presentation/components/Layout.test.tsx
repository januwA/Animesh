import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { MainLayout, NavBarLayout } from "./Layout";

const mockDeps = {
  requestNotificationPermissionUseCase: { execute: vi.fn() },
  notifyDownloadCompletionUseCase: { execute: vi.fn() },
  setThemeUseCase: { execute: vi.fn() },
};

const mockWallpaperDeps = {
  getBangumiRankedSubjectsUseCase: {
    execute: vi.fn().mockResolvedValue([]),
  },
};

function renderMainLayout(children: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          element={
            <MainLayout
              globalEffectsDeps={mockDeps}
              wallpaperDeps={mockWallpaperDeps}
            />
          }
        >
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
});

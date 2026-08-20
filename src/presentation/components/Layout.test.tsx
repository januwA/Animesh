// Layout.test.tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { MainLayout, NavBarLayout } from "./Layout";

// 背景壁纸依赖已由组件测试覆盖，布局测试中静默降级为 idle 即可
vi.mock("../hooks/useBackgroundWallpaper", () => ({
  useBackgroundWallpaper: () => ({ status: "idle", images: [] }),
}));

// 复用 mock 依赖，避免每次创建
const mockDeps = {
  requestNotificationPermissionUseCase: { execute: vi.fn() },
  notifyDownloadCompletionUseCase: { execute: vi.fn() },
  setThemeUseCase: { execute: vi.fn() },
};

const mockWallpaperDeps = {
  getBangumiRankedSubjectsUseCase: { execute: vi.fn() },
};

// 辅助函数：渲染 MainLayout
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

  it("MainLayout 应该渲染路由视图", () => {
    renderMainLayout(<div>首页内容</div>);
    expect(screen.getByText("首页内容")).toBeInTheDocument();
  });
});

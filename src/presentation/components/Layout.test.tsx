import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { lazy } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import { TorrentStatusProvider } from "@/presentation/context/TorrentStatusContext";
import type { UseGlobalEffectsDeps } from "@/presentation/hooks/useGlobalEffects";
import { MainLayout, NavBarLayout } from "./Layout";

const createGlobalEffectsDeps = (): UseGlobalEffectsDeps => ({
  requestNotificationPermissionUseCase: { execute: vi.fn() },
  notifyDownloadCompletionUseCase: { execute: vi.fn() },
  setThemeUseCase: { execute: vi.fn() },
});

const diContainer = {
  subscribeTorrentsUseCase: {
    execute: vi
      .fn()
      .mockImplementation((onUpdate: (list: unknown[]) => void) => {
        onUpdate([]);
        return Promise.resolve(() => {});
      }),
  },
} as unknown as DIContainer;

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
    expect(screen.getByRole("link", { name: "搜索" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "设置" })).toBeInTheDocument();
  });

  it("MainLayout 应该渲染路由视图", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <DIProvider value={diContainer}>
          <TorrentStatusProvider>
            <MemoryRouter initialEntries={["/"]}>
              <Routes>
                <Route
                  element={
                    <MainLayout globalEffectsDeps={createGlobalEffectsDeps()} />
                  }
                >
                  <Route index element={<div>首页内容</div>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </TorrentStatusProvider>
        </DIProvider>
      </ThemeProvider>,
    );

    expect(screen.getByText("首页内容")).toBeInTheDocument();
  });

  it("MainLayout 对懒加载路由应展示 PageLoader 占位并最终渲染内容", async () => {
    const LazyView = lazy(() =>
      Promise.resolve({ default: () => <div>懒加载内容</div> }),
    );

    render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <DIProvider value={diContainer}>
          <TorrentStatusProvider>
            <MemoryRouter initialEntries={["/"]}>
              <Routes>
                <Route
                  element={
                    <MainLayout globalEffectsDeps={createGlobalEffectsDeps()} />
                  }
                >
                  <Route index element={<LazyView />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </TorrentStatusProvider>
        </DIProvider>
      </ThemeProvider>,
    );

    expect(screen.getByText("正在载入页面...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("懒加载内容")).toBeInTheDocument();
    });
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DIContainer } from "@/di/DIContext";
import { DIContext } from "@/di/DIContext";
import { TooltipProvider } from "@/presentation/components/ui/tooltip";
import SettingsSidebarLayout from "./SettingsSidebarLayout";

const originalMode = import.meta.env.MODE;

function createMockContainer(): DIContainer {
  return {
    getCurrentVersionUseCase: {
      execute: vi.fn().mockResolvedValue("1.0.0"),
    },
  } as unknown as DIContainer;
}

function renderLayout(entry: string) {
  return render(
    <DIContext value={createMockContainer()}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[entry]}>
          <SettingsSidebarLayout />
        </MemoryRouter>
      </TooltipProvider>
    </DIContext>,
  );
}

describe("SettingsSidebarLayout 设置侧边栏布局", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TAURI_ENV_PLATFORM", "");
  });

  afterEach(() => {
    vi.stubEnv("MODE", originalMode);
  });

  it("应渲染侧边栏菜单项", () => {
    vi.stubEnv("MODE", "web");
    renderLayout("/settings/ai-models");

    expect(screen.getAllByText("AI 模型").length).toBeGreaterThan(0);
    expect(screen.getAllByText("翻译").length).toBeGreaterThan(0);
    expect(screen.getAllByText("缓存").length).toBeGreaterThan(0);
    expect(screen.getAllByText("外观").length).toBeGreaterThan(0);
  });

  it("非 Tauri 环境下不应显示存储、网络和关于菜单", () => {
    vi.stubEnv("MODE", "web");
    renderLayout("/settings/ai-models");

    expect(screen.queryAllByText("存储").length).toBe(0);
    expect(screen.queryAllByText("网络").length).toBe(0);
    expect(screen.queryAllByText("关于").length).toBe(0);
  });

  it("应渲染子路由内容区域", () => {
    vi.stubEnv("MODE", "web");
    renderLayout("/settings/appearance");

    expect(screen.getAllByText("外观").length).toBeGreaterThan(0);
  });

  it("移动端应显示侧边栏触发器", () => {
    vi.stubEnv("MODE", "web");
    renderLayout("/settings/cache");

    expect(screen.getAllByText("缓存").length).toBeGreaterThan(0);
  });

  it("Tauri 环境下应显示存储、网络和关于菜单", async () => {
    vi.stubEnv("MODE", "test");
    renderLayout("/settings/storage");

    await waitFor(() => {
      expect(screen.getAllByText("存储").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("网络").length).toBeGreaterThan(0);
    expect(screen.getAllByText("关于").length).toBeGreaterThan(0);
  });
});

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { toast } from "sonner";
import { vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { SettingsRepository } from "@/domain/settings/SettingsRepository";
import { resetAppStores } from "@/test/store-reset";
import { createDIContainerForTest } from "@/test/test-utils";
import Settings from "./index";

describe("Settings 页面组件", () => {
  let mockSettingsRepository: SettingsRepository;
  let mockAiClient: { post: ReturnType<typeof vi.fn> };
  let mockClearCacheUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockContainer: DIContainer;

  beforeEach(() => {
    mockSettingsRepository = {
      getSettings: vi.fn().mockResolvedValue({
        download_dir: "/default/download",
        proxy: "http://127.0.0.1:1080",
        max_download_speed: 0,
      }),
      setDownloadDir: vi.fn(),
      setProxy: vi.fn(),
      setAiConfigs: vi.fn(),
      setMaxDownloadSpeed: vi.fn(),
      setMaxUploadSpeed: vi.fn(),
      selectDirectory: vi.fn(),
      setTheme: vi.fn(),
    };

    mockAiClient = {
      post: vi.fn().mockResolvedValue({ choices: [{}] }),
    };

    mockClearCacheUseCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    };

    mockContainer = createDIContainerForTest({
      settingsRepository: mockSettingsRepository,
      aiClient: mockAiClient as never,
      clearCacheUseCase: mockClearCacheUseCase as never,
    });

    resetAppStores();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const renderSettings = () => {
    const router = createMemoryRouter(
      [
        { index: true, element: <div>Home Page</div> },
        { path: "settings", element: <Settings /> },
      ],
      { initialEntries: ["/settings"] },
    );

    render(
      <DIProvider value={mockContainer}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <RouterProvider router={router} />
        </ThemeProvider>
      </DIProvider>,
    );
    return router;
  };

  const waitLoaded = async () => {
    await waitFor(() => {
      expect(screen.queryByText("正在加载设置面版...")).not.toBeInTheDocument();
    });
  };

  const leaveToHome = async (router: ReturnType<typeof renderSettings>) => {
    await act(async () => {
      router.navigate("/");
    });
  };

  it("应该在加载时渲染加载指示器", async () => {
    vi.mocked(mockSettingsRepository.getSettings).mockImplementation(
      () => new Promise(() => {}),
    );

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("正在加载设置面版...")).toBeInTheDocument();
    });
  });

  it("加载成功后应该支持修改设置并保存", async () => {
    let currentDir = "C:\\Downloads";

    vi.mocked(mockSettingsRepository.getSettings).mockImplementation(
      async () => ({
        download_dir: NonEmptyStringSchema.parse(currentDir),
      }),
    );
    vi.mocked(mockSettingsRepository.setDownloadDir).mockImplementation(
      async (dir) => {
        currentDir = dir;
      },
    );

    renderSettings();

    await waitLoaded();

    fireEvent.change(screen.getByPlaceholderText(/选择或输入下载路径/), {
      target: { value: "D:\\New" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

    await waitFor(() => {
      expect(currentDir).toBe("D:\\New");
    });
  });

  it("在 Web 模式下，应该不渲染 Tauri 特有配置", async () => {
    vi.stubEnv("MODE", "web");

    renderSettings();

    await waitLoaded();

    expect(screen.queryByText("检查更新")).not.toBeInTheDocument();
    expect(
      screen.queryByText("存储设置 (BT 下载及缓存目录)"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("AI 智能搜索模型设置")).toBeInTheDocument();
  });

  it("修改设置后离开，可取消留在当前页或确认跳转到目标页", async () => {
    const router = renderSettings();

    await waitLoaded();

    fireEvent.change(screen.getByPlaceholderText(/选择或输入下载路径/), {
      target: { value: "D:\\New" },
    });

    await leaveToHome(router);
    expect(screen.getByText("放弃未保存的更改？")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByText("放弃未保存的更改？")).not.toBeInTheDocument();
    expect(screen.getByText("软件设置")).toBeInTheDocument();

    await leaveToHome(router);
    expect(screen.getByText("放弃未保存的更改？")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认离开" }));

    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });
  });

  it("按 Esc 关闭离开确认对话框时应该停留在设置页", async () => {
    const router = renderSettings();

    await waitLoaded();

    fireEvent.change(screen.getByPlaceholderText(/选择或输入下载路径/), {
      target: { value: "D:\\New" },
    });

    await leaveToHome(router);
    expect(screen.getByText("放弃未保存的更改？")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText("放弃未保存的更改？")).not.toBeInTheDocument();
    });
    expect(screen.getByText("软件设置")).toBeInTheDocument();
  });

  it("确认清理缓存后应该调用用例并提示成功", async () => {
    renderSettings();

    await waitLoaded();

    fireEvent.click(screen.getByRole("button", { name: "清理缓存" }));
    expect(screen.getByText("确定清理缓存数据？")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认清理" }));

    await waitFor(() => {
      expect(mockClearCacheUseCase.execute).toHaveBeenCalled();
    });
    expect(toast.success).toHaveBeenCalledWith("缓存已清理");
  });
});

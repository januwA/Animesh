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
import { ACCENT_STORAGE_KEY } from "@/presentation/hooks/useAccentTheme";
import { resetAppStores } from "@/test/store-reset";
import { createDIContainerForTest } from "@/test/test-utils";
import { NavBarLayout } from "../components/Layout";
import Settings from "./Settings";

describe("Settings 页面组件", () => {
  let mockSettingsRepository: SettingsRepository;
  let mockAiClient: { post: any };
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
      post: vi.fn(),
    };

    mockClearCacheUseCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    };

    mockContainer = createDIContainerForTest({
      settingsRepository: mockSettingsRepository,
      aiClient: mockAiClient as any,
      clearCacheUseCase: mockClearCacheUseCase as any,
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
        {
          path: "/",
          element: <NavBarLayout />,
          children: [
            { index: true, element: <div>Home Page</div> },
            {
              path: "settings",
              element: (
                <>
                  <Settings />
                </>
              ),
            },
          ],
        },
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

  it("应该在加载时渲染加载指示器", async () => {
    vi.mocked(mockSettingsRepository.getSettings).mockImplementation(
      () => new Promise(() => {}),
    );

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("正在加载设置面版...")).toBeInTheDocument();
    });
  });

  it("当加载设置失败时，应该显示 Toast 提示并关闭加载状态", async () => {
    vi.mocked(mockSettingsRepository.getSettings).mockRejectedValueOnce(
      new Error("Get settings failed"),
    );

    renderSettings();

    await waitFor(() => {
      expect(screen.queryByText("正在加载设置面版...")).not.toBeInTheDocument();
    });
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("加载设置失败"),
    );
  });

  it("应该成功加载并显示当前下载目录与代理设置，且支持输入更改与保存（成功分支）", async () => {
    let currentDir = "C:\\Downloads";
    let currentProxy = "http://127.0.0.1:7890";

    vi.mocked(mockSettingsRepository.getSettings).mockImplementation(
      async () => {
        return {
          download_dir: NonEmptyStringSchema.parse(currentDir),
          proxy: NonEmptyStringSchema.parse(currentProxy),
        };
      },
    );
    vi.mocked(mockSettingsRepository.setDownloadDir).mockImplementation(
      async (dir) => {
        currentDir = dir;
      },
    );
    vi.mocked(
      mockSettingsRepository.setProxy as (
        proxy: string | null,
      ) => Promise<void>,
    ).mockImplementation(async (proxy) => {
      currentProxy = proxy || "";
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/选择或输入下载路径/)).toHaveValue(
        "C:\\Downloads",
      );
      expect(
        screen.getByPlaceholderText(/例如 http:\/\/127.0.0.1:7890/),
      ).toHaveValue("http://127.0.0.1:7890");
    });

    const input = screen.getByPlaceholderText(/选择或输入下载路径/);
    fireEvent.change(input, { target: { value: "E:\\NewDownloads" } });

    const proxyInput = screen.getByPlaceholderText(
      /例如 http:\/\/127.0.0.1:7890/,
    );
    fireEvent.change(proxyInput, {
      target: { value: "socks5://127.0.0.1:1080" },
    });

    const speedInput = screen.getByLabelText("后台下载速度限制");
    fireEvent.change(speedInput, { target: { value: "2048" } });

    const saveBtn = screen.getByRole("button", { name: "保存设置" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSettingsRepository.setDownloadDir).toHaveBeenCalledWith(
        "E:\\NewDownloads",
      );
      expect(mockSettingsRepository.setProxy).toHaveBeenCalledWith(
        "socks5://127.0.0.1:1080",
      );
      expect(mockSettingsRepository.setMaxDownloadSpeed).toHaveBeenCalledWith(
        2048,
      );
    });
    expect(toast.success).toHaveBeenCalledWith(
      "设置已保存，后续下载任务将使用新路径",
    );
  });

  it("应该支持修改后台上传速度限制并在保存时调用 setMaxUploadSpeed", async () => {
    vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
      download_dir: NonEmptyStringSchema.parse("C:\\Downloads"),
      proxy: NonEmptyStringSchema.parse("http://127.0.0.1:1080"),
      max_upload_speed: 512,
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByLabelText("后台上传速度限制")).toHaveValue(512);
    });

    const uploadInput = screen.getByLabelText("后台上传速度限制");
    fireEvent.change(uploadInput, { target: { value: "1024" } });

    const saveBtn = screen.getByRole("button", { name: "保存设置" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSettingsRepository.setMaxUploadSpeed).toHaveBeenCalledWith(
        1024,
      );
      expect(mockSettingsRepository.setDownloadDir).toHaveBeenCalledWith(
        "C:\\Downloads",
      );
    });
  });

  it("当载入设置未含上传限制时，上传速度限制应该默认为 0", async () => {
    vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
      download_dir: NonEmptyStringSchema.parse("C:\\Downloads"),
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByLabelText("后台上传速度限制")).toHaveValue(0);
    });
  });

  it("当保存下载目录为空时，应该拦截并提示不能为空", async () => {
    vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
      download_dir: NonEmptyStringSchema.parse("C:\\Downloads"),
    });

    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/选择或输入下载路径/),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/选择或输入下载路径/);
    fireEvent.change(input, { target: { value: "   " } });

    const saveBtn = screen.getByRole("button", { name: "保存设置" });
    fireEvent.click(saveBtn);

    expect(toast.error).toHaveBeenCalledWith("下载目录不能为空");
    expect(mockSettingsRepository.setDownloadDir).not.toHaveBeenCalled();
  });

  it("当保存路径失败时，应该提示相应的错误信息（包含字符串错误 and 非字符串错误）", async () => {
    vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
      download_dir: NonEmptyStringSchema.parse("C:\\Downloads"),
    });

    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/选择或输入下载路径/),
      ).toBeInTheDocument();
    });

    // 1. String error
    vi.mocked(mockSettingsRepository.setDownloadDir).mockRejectedValueOnce(
      "Path not writeable",
    );

    const saveBtn = screen.getByRole("button", { name: "保存设置" });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Path not writeable"),
        { duration: 5000 },
      );
    });

    // 2. Non-string error (Error object)
    vi.mocked(mockSettingsRepository.setDownloadDir).mockRejectedValueOnce(
      new Error("Permission Denied"),
    );

    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Permission Denied"),
        { duration: 5000 },
      );
    });
  });

  it("应该支持通过选择目录按钮更新目录，并能妥善处理选择文件夹失败的分支", async () => {
    vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
      download_dir: NonEmptyStringSchema.parse("C:\\Downloads"),
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("选择目录")).toBeInTheDocument();
    });

    // 1. Directory selection succeeds with value
    vi.mocked(mockSettingsRepository.selectDirectory).mockResolvedValue(
      NonEmptyStringSchema.parse("D:\\SelectedDir"),
    );

    const selectBtn = screen.getByRole("button", { name: "选择目录" });
    fireEvent.click(selectBtn);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/选择或输入下载路径/)).toHaveValue(
        "D:\\SelectedDir",
      );
    });
    expect(toast.success).toHaveBeenCalledWith("已选择目录，点击保存以生效");

    // 2. Directory selection returns null (user cancelled)
    vi.mocked(mockSettingsRepository.selectDirectory).mockResolvedValue(null);

    fireEvent.click(selectBtn);
    await act(async () => {});
    expect(screen.getByPlaceholderText(/选择或输入下载路径/)).toHaveValue(
      "D:\\SelectedDir",
    );

    // 3. Directory selection fails
    vi.mocked(mockSettingsRepository.selectDirectory).mockRejectedValueOnce(
      "Native dialog error",
    );

    fireEvent.click(selectBtn);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("选择文件夹失败"),
      );
    });
  });

  it("应该支持检查更新，并在发现新版本时支持前往 GitHub 下载", async () => {
    const mockCheckUpdate = {
      execute: vi.fn().mockResolvedValue({
        hasUpdate: true,
        latestVersion: "0.3.2",
        currentVersion: "0.3.1",
        notes: "修复了一些已知问题",
        url: "https://example.com/download",
        htmlUrl: "https://github.com/example/repo",
      }),
    };
    const mockOpenUrl = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    const mockGetVersion = {
      execute: vi.fn().mockResolvedValue("0.3.1"),
    };

    mockContainer = createDIContainerForTest({
      settingsRepository: mockSettingsRepository,
      checkUpdateUseCase: mockCheckUpdate as any,
      openUpdateUrlUseCase: mockOpenUrl as any,
      getCurrentVersionUseCase: mockGetVersion as any,
    });

    renderSettings();

    // 等待版本号显示
    await waitFor(() => {
      expect(screen.getByText("当前版本：0.3.1")).toBeInTheDocument();
    });

    // 点击检查更新按钮
    const checkBtn = screen.getByRole("button", { name: /检查更新/ });
    fireEvent.click(checkBtn);

    // 检查 toast 提示和新版本内容渲染
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith("发现新版本 v0.3.2");
    });
    await waitFor(() => {
      expect(screen.getByText("发现新版本！")).toBeInTheDocument();
      expect(screen.getByText("修复了一些已知问题")).toBeInTheDocument();
    });

    // 点击前往下载按钮
    const downloadBtn = screen.getByRole("button", {
      name: /前往 GitHub 下载/,
    });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(mockOpenUrl.execute).toHaveBeenCalledWith(
        "https://github.com/example/repo",
      );
    });
  });

  it("当检查更新显示没有新版本时，应该显示最新提示", async () => {
    const mockCheckUpdate = {
      execute: vi.fn().mockResolvedValue({
        hasUpdate: false,
        latestVersion: "0.3.1",
        currentVersion: "0.3.1",
        notes: "",
        htmlUrl: "https://github.com/example/repo",
      }),
    };
    const mockGetVersion = {
      execute: vi.fn().mockResolvedValue("0.3.1"),
    };

    mockContainer = createDIContainerForTest({
      settingsRepository: mockSettingsRepository,
      checkUpdateUseCase: mockCheckUpdate as any,
      getCurrentVersionUseCase: mockGetVersion as any,
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("当前版本：0.3.1")).toBeInTheDocument();
    });

    const checkBtn = screen.getByRole("button", { name: /检查更新/ });
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("当前已是最新版本");
    });
  });

  it("当检查更新失败时，应当妥善提示错误信息", async () => {
    const mockCheckUpdate = {
      execute: vi.fn().mockRejectedValue(new Error("网络连接失败")),
    };
    const mockGetVersion = {
      execute: vi.fn().mockResolvedValue("0.3.1"),
    };

    mockContainer = createDIContainerForTest({
      settingsRepository: mockSettingsRepository,
      checkUpdateUseCase: mockCheckUpdate as any,
      getCurrentVersionUseCase: mockGetVersion as any,
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("当前版本：0.3.1")).toBeInTheDocument();
    });

    const checkBtn = screen.getByRole("button", { name: /检查更新/ });
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("检查更新失败: 网络连接失败");
    });
  });

  it("当打开链接失败时，应当妥善提示错误信息", async () => {
    const mockCheckUpdateSuccess = {
      execute: vi.fn().mockResolvedValue({
        hasUpdate: true,
        latestVersion: "0.3.2",
        currentVersion: "0.3.1",
        notes: "修复了一些已知问题",
        url: "https://example.com/download",
        htmlUrl: "https://github.com/example/repo",
      }),
    };
    const mockOpenUrlFail = {
      execute: vi.fn().mockRejectedValue(new Error("打不开系统默认浏览器")),
    };
    const mockGetVersion = {
      execute: vi.fn().mockResolvedValue("0.3.1"),
    };

    mockContainer = createDIContainerForTest({
      settingsRepository: mockSettingsRepository,
      checkUpdateUseCase: mockCheckUpdateSuccess as any,
      openUpdateUrlUseCase: mockOpenUrlFail as any,
      getCurrentVersionUseCase: mockGetVersion as any,
    });

    renderSettings();

    // 点击检查更新以呈现下载按钮
    await waitFor(() => {
      const checkBtn = screen.getByRole("button", { name: /检查更新/ });
      fireEvent.click(checkBtn);
    });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith("发现新版本 v0.3.2");
    });

    const downloadBtn = screen.getByRole("button", {
      name: /前往 GitHub 下载/,
    });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "无法打开链接: 打不开系统默认浏览器",
      );
    });
  });

  it("在没有提供 htmlUrl 时，点击前往 GitHub 下载不应该执行任何操作", async () => {
    const mockCheckUpdateSuccess = {
      execute: vi.fn().mockResolvedValue({
        hasUpdate: true,
        latestVersion: "0.3.2",
        currentVersion: "0.3.1",
        notes: "修复了一些已知问题",
        url: "https://example.com/download",
        htmlUrl: undefined,
      }),
    };
    const mockOpenUrl = {
      execute: vi.fn(),
    };
    const mockGetVersion = {
      execute: vi.fn().mockResolvedValue("0.3.1"),
    };

    mockContainer = createDIContainerForTest({
      settingsRepository: mockSettingsRepository,
      checkUpdateUseCase: mockCheckUpdateSuccess as any,
      openUpdateUrlUseCase: mockOpenUrl as any,
      getCurrentVersionUseCase: mockGetVersion as any,
    });

    renderSettings();

    await waitFor(() => {
      const checkBtn = screen.getByRole("button", { name: /检查更新/ });
      fireEvent.click(checkBtn);
    });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith("发现新版本 v0.3.2");
    });

    const downloadBtn = screen.getByRole("button", {
      name: /前往 GitHub 下载/,
    });
    fireEvent.click(downloadBtn);

    expect(mockOpenUrl.execute).not.toHaveBeenCalled();
  });

  it("在移动端（如 Android/iOS）下，应该禁用目录修改并展示提示", async () => {
    const userAgentSpy = vi
      .spyOn(navigator, "userAgent", "get")
      .mockReturnValue("Android");

    renderSettings();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("应用沙盒内部路径")).toBeDisabled();
      expect(
        screen.getByText(
          "移动端（Android/iOS）已自动选用应用沙盒内部路径，无需且不支持手动更改。",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "选择目录" }),
      ).not.toBeInTheDocument();
    });

    userAgentSpy.mockRestore();
  });

  it("在 Web 模式下，应该不渲染 Tauri 特有配置（如更新卡片、下载路径修改等）", async () => {
    vi.stubEnv("MODE", "web");
    renderSettings();
    await waitFor(() => {
      expect(screen.queryByText("正在加载设置面版...")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("检查更新")).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it("在版本加载中时，应该渲染加载中提示", async () => {
    let resolveVersion: any;
    const promise = new Promise<string>((resolve) => {
      resolveVersion = resolve;
    });

    mockContainer = createDIContainerForTest({
      settingsRepository: mockSettingsRepository,
      updateRepository: {
        getCurrentVersion: vi.fn().mockReturnValue(promise),
      } as any,
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.queryByText("正在加载设置面版...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("当前版本：加载中...")).toBeInTheDocument();

    await act(async () => {
      resolveVersion("1.0.0");
    });

    await waitFor(() => {
      expect(screen.getByText("当前版本：1.0.0")).toBeInTheDocument();
    });
  });

  it("应该支持加载和配置 AI Agent 相关的设置", async () => {
    vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
      download_dir: NonEmptyStringSchema.parse("C:\\Downloads"),
      proxy: NonEmptyStringSchema.parse("http://127.0.0.1:1080"),
      ai_configs: [],
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("AI 智能搜索模型设置")).toBeInTheDocument();
    });

    // 点击添加 AI 配置按钮
    const addBtn = screen.getByRole("button", { name: "+ 添加 AI 配置" });
    fireEvent.click(addBtn);

    // 输入值
    const aliasInput = screen.getByLabelText(
      "配置别名 (Alias) *",
    ) as HTMLInputElement;
    const endpointInput = screen.getByLabelText(
      "AI 接口地址 (Endpoint) *",
    ) as HTMLInputElement;
    const keyInput = screen.getByLabelText(
      "API 密钥 (API Key) *",
    ) as HTMLInputElement;
    const modelInput = screen.getByLabelText(
      "模型名称 (Model)",
    ) as HTMLInputElement;

    fireEvent.change(aliasInput, { target: { value: "OpenAI" } });
    fireEvent.change(endpointInput, {
      target: { value: "https://api.openai.com/v1" },
    });
    fireEvent.change(keyInput, { target: { value: "new-secret-key" } });
    fireEvent.change(modelInput, { target: { value: "gpt-4o" } });

    expect(aliasInput.value).toBe("OpenAI");
    expect(endpointInput.value).toBe("https://api.openai.com/v1");
    expect(keyInput.value).toBe("new-secret-key");
    expect(modelInput.value).toBe("gpt-4o");

    // 保存单项配置
    const saveConfigBtn = screen.getByRole("button", { name: "保存配置" });
    fireEvent.click(saveConfigBtn);

    // 保存所有设置
    const saveBtn = screen.getByRole("button", { name: "保存设置" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSettingsRepository.setAiConfigs).toHaveBeenCalledWith([
        {
          alias: "OpenAI",
          api_endpoint: "https://api.openai.com/v1",
          api_key: "new-secret-key",
          ai_model: "gpt-4o",
        },
      ]);
    });
  });

  it("当测试 AI 连接时，如果地址或密钥为空，应该提示警告", async () => {
    vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
      download_dir: NonEmptyStringSchema.parse("C:\\Downloads"),
      ai_configs: [],
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("AI 智能搜索模型设置")).toBeInTheDocument();
    });

    // 点击添加 AI 配置按钮
    const addBtn = screen.getByRole("button", { name: "+ 添加 AI 配置" });
    fireEvent.click(addBtn);

    const testBtn = screen.getByRole("button", { name: "测试模型连接" });

    // 1. 地址为空
    fireEvent.click(testBtn);
    expect(toast.warning).toHaveBeenCalledWith("请输入 AI 接口地址");

    // 2. 密钥为空
    const endpointInput = screen.getByLabelText(
      "AI 接口地址 (Endpoint) *",
    ) as HTMLInputElement;
    fireEvent.change(endpointInput, {
      target: { value: "https://api.openai.com/v1" },
    });

    fireEvent.click(testBtn);
    expect(toast.warning).toHaveBeenCalledWith("请输入 API 密钥");
  });

  it("应该支持在 AI 设置面板中测试模型连接并展示成功提示", async () => {
    vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
      download_dir: NonEmptyStringSchema.parse("C:\\Downloads"),
      ai_configs: [
        {
          alias: NonEmptyStringSchema.parse("OpenAI"),
          api_endpoint: NonEmptyStringSchema.parse("https://api.openai.com/v1"),
          api_key: NonEmptyStringSchema.parse("my-secret-key"),
          ai_model: NonEmptyStringSchema.parse("gpt-4o"),
        },
      ],
    });

    vi.mocked(mockAiClient.post).mockResolvedValueOnce({
      choices: [{ message: { content: "hello" } }],
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("AI 智能搜索模型设置")).toBeInTheDocument();
    });

    const testBtn = screen.getByRole("button", { name: "测试" });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(mockAiClient.post).toHaveBeenCalledWith(
        "https://api.openai.com/v1",
        "my-secret-key",
        expect.objectContaining({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Ping" }],
        }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith("AI 模型连接测试成功！");
  });

  it("应该支持在 AI 设置面板中测试模型连接并展示失败提示", async () => {
    vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
      download_dir: NonEmptyStringSchema.parse("C:\\Downloads"),
      ai_configs: [
        {
          alias: NonEmptyStringSchema.parse("OpenAI"),
          api_endpoint: NonEmptyStringSchema.parse("https://api.openai.com/v1"),
          api_key: NonEmptyStringSchema.parse("my-secret-key"),
          ai_model: NonEmptyStringSchema.parse("gpt-4o"),
        },
      ],
    });

    vi.mocked(mockAiClient.post).mockRejectedValueOnce(new Error("API Error"));

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("AI 智能搜索模型设置")).toBeInTheDocument();
    });

    const testBtn = screen.getByRole("button", { name: "测试" });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/AI 模型连接测试失败: API Error/),
        { duration: 5000 },
      );
    });
  });

  it("在 AI 设置面板中，应该支持测试当前正在编辑的配置连接", async () => {
    vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
      download_dir: NonEmptyStringSchema.parse("C:\\Downloads"),
      ai_configs: [],
    });
    vi.mocked(mockAiClient.post).mockResolvedValueOnce({
      choices: [{ message: { content: "hello" } }],
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("AI 智能搜索模型设置")).toBeInTheDocument();
    });

    const addBtn = screen.getByRole("button", { name: "+ 添加 AI 配置" });
    fireEvent.click(addBtn);

    const aliasInput = screen.getByLabelText(
      "配置别名 (Alias) *",
    ) as HTMLInputElement;
    const endpointInput = screen.getByLabelText(
      "AI 接口地址 (Endpoint) *",
    ) as HTMLInputElement;
    const keyInput = screen.getByLabelText(
      "API 密钥 (API Key) *",
    ) as HTMLInputElement;
    const modelInput = screen.getByLabelText(
      "模型名称 (Model)",
    ) as HTMLInputElement;

    fireEvent.change(aliasInput, { target: { value: "测试别名" } });
    fireEvent.change(endpointInput, {
      target: { value: "https://api.test-form.com" },
    });
    fireEvent.change(keyInput, { target: { value: "form-key" } });
    fireEvent.change(modelInput, { target: { value: "test-model" } });

    const testBtn = screen.getByRole("button", { name: "测试模型连接" });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(mockAiClient.post).toHaveBeenCalledWith(
        "https://api.test-form.com",
        "form-key",
        expect.objectContaining({ model: "test-model" }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith("AI 模型连接测试成功！");
  });

  it("应该支持对已添加的 AI 配置进行编辑、取消编辑以及保存修改", async () => {
    vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
      download_dir: NonEmptyStringSchema.parse("C:\\Downloads"),
      proxy: NonEmptyStringSchema.parse("http://127.0.0.1:1080"),
      ai_configs: [
        {
          alias: NonEmptyStringSchema.parse("OpenAI"),
          api_endpoint: NonEmptyStringSchema.parse("https://api.openai.com/v1"),
          api_key: NonEmptyStringSchema.parse("old-key"),
          ai_model: NonEmptyStringSchema.parse("gpt-4o"),
        },
      ],
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("OpenAI")).toBeInTheDocument();
    });

    // 1. 点击编辑
    const editBtn = screen.getByRole("button", { name: "编辑" });
    fireEvent.click(editBtn);

    // 检查表单已被填充
    const aliasInput = screen.getByLabelText(
      "配置别名 (Alias) *",
    ) as HTMLInputElement;
    const keyInput = screen.getByLabelText(
      "API 密钥 (API Key) *",
    ) as HTMLInputElement;
    expect(aliasInput.value).toBe("OpenAI");
    expect(keyInput.value).toBe("old-key");

    // 2. 取消编辑
    const cancelBtn = screen.getByRole("button", { name: "取消" });
    fireEvent.click(cancelBtn);
    expect(
      screen.queryByLabelText("配置别名 (Alias) *"),
    ).not.toBeInTheDocument();

    // 3. 再次编辑并修改保存
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    const aliasInput2 = screen.getByLabelText(
      "配置别名 (Alias) *",
    ) as HTMLInputElement;
    fireEvent.change(aliasInput2, { target: { value: "OpenAI-Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "保存配置" }));

    // 保存全部设置
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

    await waitFor(() => {
      expect(mockSettingsRepository.setAiConfigs).toHaveBeenCalledWith([
        {
          alias: "OpenAI-Updated",
          api_endpoint: "https://api.openai.com/v1",
          api_key: "old-key",
          ai_model: "gpt-4o",
        },
      ]);
    });
  });

  it("应该支持删除已添加的 AI 配置，并正确重置或修正编辑索引", async () => {
    vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
      download_dir: NonEmptyStringSchema.parse("C:\\Downloads"),
      proxy: NonEmptyStringSchema.parse("http://127.0.0.1:1080"),
      ai_configs: [
        {
          alias: NonEmptyStringSchema.parse("Config1"),
          api_endpoint: NonEmptyStringSchema.parse("https://api1.com"),
          api_key: NonEmptyStringSchema.parse("key1"),
          ai_model: NonEmptyStringSchema.parse("model1"),
        },
        {
          alias: NonEmptyStringSchema.parse("Config2"),
          api_endpoint: NonEmptyStringSchema.parse("https://api2.com"),
          api_key: NonEmptyStringSchema.parse("key2"),
          ai_model: NonEmptyStringSchema.parse("model2"),
        },
        {
          alias: NonEmptyStringSchema.parse("Config3"),
          api_endpoint: NonEmptyStringSchema.parse("https://api3.com"),
          api_key: NonEmptyStringSchema.parse("key3"),
          ai_model: NonEmptyStringSchema.parse("model3"),
        },
      ],
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("Config1")).toBeInTheDocument();
      expect(screen.getByText("Config2")).toBeInTheDocument();
      expect(screen.getByText("Config3")).toBeInTheDocument();
    });

    // 1. 删除一个非编辑状态的配置
    const deleteBtns = screen.getAllByRole("button", { name: "删除" });
    fireEvent.click(deleteBtns[2]); // 删除 Config3 (index 2)
    expect(screen.queryByText("Config3")).not.toBeInTheDocument();

    // 2. 删除正在编辑的配置 (删除 Config2)
    const editBtns = screen.getAllByRole("button", { name: "编辑" });
    fireEvent.click(editBtns[1]); // 编辑 Config2
    const deleteBtns2 = screen.getAllByRole("button", { name: "删除" });
    fireEvent.click(deleteBtns2[1]); // 删除 Config2
    // 验证编辑表单被关闭了
    expect(
      screen.queryByRole("button", { name: "取消" }),
    ).not.toBeInTheDocument();

    // 此时列表里仅剩 Config1 (index 0)
    // 我们再添加一个，构造两个配置，以测试编辑后面那个配置，删除前面那个配置的场景
    const addBtn = screen.getByRole("button", { name: "+ 添加 AI 配置" });
    fireEvent.click(addBtn);

    const saveConfigBtn = screen.getByRole("button", { name: "保存配置" });
    const aliasInput = screen.getByLabelText(
      "配置别名 (Alias) *",
    ) as HTMLInputElement;
    const endpointInput = screen.getByLabelText(
      "AI 接口地址 (Endpoint) *",
    ) as HTMLInputElement;
    const keyInput = screen.getByLabelText(
      "API 密钥 (API Key) *",
    ) as HTMLInputElement;
    const modelInput = screen.getByLabelText(
      "模型名称 (Model)",
    ) as HTMLInputElement;

    fireEvent.change(aliasInput, { target: { value: "NewConfig" } });
    fireEvent.change(endpointInput, {
      target: { value: "https://apinew.com" },
    });
    fireEvent.change(keyInput, { target: { value: "keynew" } });
    fireEvent.change(modelInput, { target: { value: "new-model" } });
    fireEvent.click(saveConfigBtn);

    // 现在有两个配置：Config1 (index 0) 和 NewConfig (index 1)
    // 编辑 NewConfig (index 1)
    const editBtns3 = screen.getAllByRole("button", { name: "编辑" });
    fireEvent.click(editBtns3[1]);

    // 删除 Config1 (index 0)
    const deleteBtns3 = screen.getAllByRole("button", { name: "删除" });
    fireEvent.click(deleteBtns3[0]);

    // 现在剩下 NewConfig，它移动到了 index 0
    // 因为编辑索引被移动到了 index 0，修改它并保存配置，应该成功更新 NewConfig
    const aliasInput2 = screen.getByLabelText(
      "配置别名 (Alias) *",
    ) as HTMLInputElement;
    fireEvent.change(aliasInput2, { target: { value: "NewConfig-Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "保存配置" }));

    // 保存全部设置
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

    await waitFor(() => {
      expect(mockSettingsRepository.setAiConfigs).toHaveBeenCalledWith([
        {
          alias: "NewConfig-Updated",
          api_endpoint: "https://apinew.com",
          api_key: "keynew",
          ai_model: "new-model",
        },
      ]);
    });
  });

  it("添加/保存配置时应该有相应的表单字段及重复校验警告", async () => {
    vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
      download_dir: NonEmptyStringSchema.parse("C:\\Downloads"),
      ai_configs: [
        {
          alias: NonEmptyStringSchema.parse("OpenAI"),
          api_endpoint: NonEmptyStringSchema.parse("https://api.openai.com/v1"),
          api_key: NonEmptyStringSchema.parse("my-key"),
          ai_model: NonEmptyStringSchema.parse("gpt-4o"),
        },
      ],
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("OpenAI")).toBeInTheDocument();
    });

    const addBtn = screen.getByRole("button", { name: "+ 添加 AI 配置" });
    fireEvent.click(addBtn);

    const saveBtn = screen.getByRole("button", { name: "保存配置" });
    const aliasInput = screen.getByLabelText(
      "配置别名 (Alias) *",
    ) as HTMLInputElement;
    const endpointInput = screen.getByLabelText(
      "AI 接口地址 (Endpoint) *",
    ) as HTMLInputElement;
    const keyInput = screen.getByLabelText(
      "API 密钥 (API Key) *",
    ) as HTMLInputElement;

    // 1. 空别名
    fireEvent.click(saveBtn);
    expect(toast.warning).toHaveBeenCalledWith("请输入别名");

    // 2. 空接口
    fireEvent.change(aliasInput, { target: { value: "NewAlias" } });
    fireEvent.click(saveBtn);
    expect(toast.warning).toHaveBeenCalledWith("请输入接口地址");

    // 3. 空密钥
    fireEvent.change(endpointInput, {
      target: { value: "https://api.new.com" },
    });
    fireEvent.click(saveBtn);
    expect(toast.warning).toHaveBeenCalledWith("请输入 API 密钥");

    // 4. 重复别名
    fireEvent.change(keyInput, { target: { value: "new-key" } });
    fireEvent.change(aliasInput, { target: { value: "OpenAI" } }); // OpenAI is duplicate
    fireEvent.click(saveBtn);
    expect(toast.warning).toHaveBeenCalledWith("该别名已存在，请使用其他别名");
  });

  it("应该支持选择不同的界面主题并应用", async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("外观设置")).toBeInTheDocument();
    });

    const systemBtn = screen.getByRole("radio", { name: "跟随系统" });
    const lightBtn = screen.getByRole("radio", { name: "浅色模式" });
    const darkBtn = screen.getByRole("radio", { name: "深色模式" });

    expect(systemBtn).toBeInTheDocument();
    expect(lightBtn).toBeInTheDocument();
    expect(darkBtn).toBeInTheDocument();

    fireEvent.click(lightBtn);
    await waitFor(() => {
      expect(localStorage.getItem("theme")).toBe("light");
    });

    fireEvent.click(darkBtn);
    await waitFor(() => {
      expect(localStorage.getItem("theme")).toBe("dark");
    });
  });

  it("应该提供主色色块选择，默认选中 indigo 并应用到 html 属性", async () => {
    window.localStorage.removeItem(ACCENT_STORAGE_KEY);
    delete document.documentElement.dataset.accent;

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("外观设置")).toBeInTheDocument();
    });

    expect(screen.getByText("选择主色调")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "翠绿" })).toBeInTheDocument();

    const indigoBtn = screen.getByRole("button", { name: "靛蓝" });
    expect(indigoBtn).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.accent).toBe("indigo");
  });

  it("点击主色色块后应该切换主色并同步 localStorage 与 html 属性", async () => {
    window.localStorage.removeItem(ACCENT_STORAGE_KEY);
    delete document.documentElement.dataset.accent;

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("外观设置")).toBeInTheDocument();
    });

    const emeraldBtn = screen.getByRole("button", { name: "翠绿" });
    fireEvent.click(emeraldBtn);

    await waitFor(() => {
      expect(emeraldBtn).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "靛蓝" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });
    expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe("emerald");
    expect(document.documentElement.dataset.accent).toBe("emerald");
  });

  it("应该从 localStorage 恢复上次选择的主色", async () => {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, "rose");

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("外观设置")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "玫瑰" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(document.documentElement.dataset.accent).toBe("rose");
  });

  it("未修改设置时离开页面，不应弹出离开确认对话框", async () => {
    const router = renderSettings();

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/选择或输入下载路径/),
      ).toBeInTheDocument();
    });

    await act(async () => {
      router.navigate("/");
    });

    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });
    expect(screen.queryByText("放弃未保存的更改？")).not.toBeInTheDocument();
  });

  it("修改设置后离开页面，应弹出离开确认对话框并停留在设置页", async () => {
    const router = renderSettings();

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/选择或输入下载路径/),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/选择或输入下载路径/);
    fireEvent.change(input, { target: { value: "E:\\ChangedDir" } });

    await act(async () => {
      router.navigate("/");
    });

    await waitFor(() => {
      expect(screen.getByText("放弃未保存的更改？")).toBeInTheDocument();
    });
    expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
  });

  it("在离开确认对话框点击取消，应关闭对话框并停留在设置页", async () => {
    const router = renderSettings();

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/选择或输入下载路径/),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/选择或输入下载路径/);
    fireEvent.change(input, { target: { value: "E:\\ChangedDir" } });

    await act(async () => {
      router.navigate("/");
    });

    await waitFor(() => {
      expect(screen.getByText("放弃未保存的更改？")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    await waitFor(() => {
      expect(screen.queryByText("放弃未保存的更改？")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
  });

  it("在离开确认对话框按 Esc 关闭时，应关闭对话框并停留在设置页", async () => {
    const router = renderSettings();

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/选择或输入下载路径/),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/选择或输入下载路径/);
    fireEvent.change(input, { target: { value: "E:\\ChangedDir" } });

    await act(async () => {
      router.navigate("/");
    });

    await waitFor(() => {
      expect(screen.getByText("放弃未保存的更改？")).toBeInTheDocument();
    });

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() => {
      expect(screen.queryByText("放弃未保存的更改？")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
  });

  it("在离开确认对话框点击确认离开，应跳转到目标页面", async () => {
    const router = renderSettings();

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/选择或输入下载路径/),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/选择或输入下载路径/);
    fireEvent.change(input, { target: { value: "E:\\ChangedDir" } });

    await act(async () => {
      router.navigate("/");
    });

    await waitFor(() => {
      expect(screen.getByText("放弃未保存的更改？")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "确认离开" }));

    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });
  });

  it("修改并保存成功后离开页面，不应弹出离开确认对话框", async () => {
    const router = renderSettings();

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/选择或输入下载路径/),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/选择或输入下载路径/);
    fireEvent.change(input, { target: { value: "E:\\ChangedDir" } });

    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "设置已保存，后续下载任务将使用新路径",
      );
    });

    await act(async () => {
      router.navigate("/");
    });

    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });
    expect(screen.queryByText("放弃未保存的更改？")).not.toBeInTheDocument();
  });

  it("应该渲染缓存管理卡片与清理缓存按钮", async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("缓存管理")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "清理缓存" }),
    ).toBeInTheDocument();
  });

  it("点击清理缓存应弹出确认对话框，取消时不执行清理", async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("缓存管理")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "清理缓存" }));
    expect(screen.getByText("确定清理缓存数据？")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    await waitFor(() => {
      expect(screen.queryByText("确定清理缓存数据？")).not.toBeInTheDocument();
    });
    expect(mockClearCacheUseCase.execute).not.toHaveBeenCalled();
  });

  it("确认清理缓存后应该调用用例并提示成功", async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("缓存管理")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "清理缓存" }));
    fireEvent.click(screen.getByRole("button", { name: "确认清理" }));

    await waitFor(() => {
      expect(mockClearCacheUseCase.execute).toHaveBeenCalled();
    });
    expect(toast.success).toHaveBeenCalledWith("缓存已清理");
  });

  it("清理缓存失败时应该提示错误信息", async () => {
    vi.mocked(mockClearCacheUseCase.execute).mockRejectedValueOnce(
      new Error("IndexedDB 清理失败"),
    );

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("缓存管理")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "清理缓存" }));
    fireEvent.click(screen.getByRole("button", { name: "确认清理" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("清理缓存失败: IndexedDB 清理失败"),
      );
    });
  });
});

import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import type { SettingsRepository } from "@/domain/settings/SettingsRepository";
import { createDIContainerForTest } from "@/test/test-utils";
import Layout from "../components/Layout";
import { AppContextProvider } from "../context/AppContext";
import Settings from "./Settings";

const currentLocation = {
	current: null as { pathname: string; search: string } | null,
};
const LocationTracker = () => {
	currentLocation.current = useLocation();
	return null;
};

describe("Settings 页面组件", () => {
	let mockSettingsRepository: SettingsRepository;
	let mockAiClient: { post: any };
	let mockContainer: DIContainer;

	beforeEach(() => {
		mockSettingsRepository = {
			getSettings: vi.fn().mockResolvedValue({
				download_dir: "/default/download",
				proxy: "",
				trackers: [],
				tracker_source_type: "best",
				tracker_cdn: "jsdelivr",
				tracker_custom_url: "",
				tracker_auto_update: false,
				tracker_last_update_time: 0,
			}),
			setDownloadDir: vi.fn(),
			setProxy: vi.fn(),
			setTrackers: vi.fn(),
			setTrackerOptions: vi.fn(),
			setAiConfigs: vi.fn(),
			fetchTrackers: vi.fn(),
			selectDirectory: vi.fn(),
			setTheme: vi.fn(),
		};

		mockAiClient = {
			post: vi.fn(),
		};

		mockContainer = createDIContainerForTest({
			settingsRepository: mockSettingsRepository,
			aiClient: mockAiClient as any,
		});

		currentLocation.current = null;
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllEnvs();
	});

	const renderSettings = () => {
		return render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
						<MemoryRouter initialEntries={["/settings"]}>
							<LocationTracker />
							<Routes>
								<Route path="/" element={<Layout />}>
									<Route path="settings" element={<Settings />} />
								</Route>
								<Route path="/" element={<div>Home Page</div>} />
							</Routes>
						</MemoryRouter>
					</ThemeProvider>
				</AppContextProvider>
			</DIProvider>,
		);
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
			expect(
				screen.getByText("加载设置失败", { exact: false }),
			).toBeInTheDocument();
		});
	});

	it("应该成功加载并显示当前下载目录与代理设置，且支持输入更改与保存（成功分支）", async () => {
		let currentDir = "C:\\Downloads";
		let currentProxy = "http://127.0.0.1:7890";
		let currentTrackers: string[] = ["udp://tracker1"];

		vi.mocked(mockSettingsRepository.getSettings).mockImplementation(
			async () => {
				return {
					download_dir: currentDir,
					proxy: currentProxy,
					trackers: currentTrackers,
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
		vi.mocked(mockSettingsRepository.setTrackers).mockImplementation(
			async (trackers) => {
				currentTrackers = trackers;
			},
		);

		renderSettings();

		await waitFor(() => {
			expect(screen.getByPlaceholderText(/选择或输入下载路径/)).toHaveValue(
				"C:\\Downloads",
			);
			expect(
				screen.getByPlaceholderText(/例如 http:\/\/127.0.0.1:7890/),
			).toHaveValue("http://127.0.0.1:7890");
			expect(screen.getByPlaceholderText(/请输入 Tracker 地址/)).toHaveValue(
				"udp://tracker1",
			);
		});

		const input = screen.getByPlaceholderText(/选择或输入下载路径/);
		fireEvent.change(input, { target: { value: "E:\\NewDownloads" } });

		const proxyInput = screen.getByPlaceholderText(
			/例如 http:\/\/127.0.0.1:7890/,
		);
		fireEvent.change(proxyInput, {
			target: { value: "socks5://127.0.0.1:1080" },
		});

		const trackersInput = screen.getByPlaceholderText(/请输入 Tracker 地址/);
		fireEvent.change(trackersInput, {
			target: { value: "udp://tracker2\nhttp://tracker3" },
		});

		const saveBtn = screen.getByRole("button", { name: "保存设置" });
		fireEvent.click(saveBtn);

		await waitFor(() => {
			expect(mockSettingsRepository.setDownloadDir).toHaveBeenCalledWith(
				"E:\\NewDownloads",
			);
			expect(mockSettingsRepository.setProxy).toHaveBeenCalledWith(
				"socks5://127.0.0.1:1080",
			);
			expect(mockSettingsRepository.setTrackers).toHaveBeenCalledWith([
				"udp://tracker2",
				"http://tracker3",
			]);
			expect(
				screen.getByText("设置已保存，后续下载任务将使用新路径"),
			).toBeInTheDocument();
		});
	});

	it("当保存下载目录为空时，应该拦截并提示不能为空", async () => {
		vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
			download_dir: "C:\\Downloads",
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

		expect(screen.getByText("下载目录不能为空")).toBeInTheDocument();
		expect(mockSettingsRepository.setDownloadDir).not.toHaveBeenCalled();
	});

	it("当保存路径失败时，应该提示相应的错误信息（包含字符串错误 and 非字符串错误）", async () => {
		vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
			download_dir: "C:\\Downloads",
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
			expect(
				screen.getByText("Path not writeable", { exact: false }),
			).toBeInTheDocument();
		});

		// 2. Non-string error (Error object)
		vi.mocked(mockSettingsRepository.setDownloadDir).mockRejectedValueOnce(
			new Error("Permission Denied"),
		);

		fireEvent.click(saveBtn);
		await waitFor(() => {
			expect(
				screen.getByText("Permission Denied", { exact: false }),
			).toBeInTheDocument();
		});
	});

	it("应该支持通过选择目录按钮更新目录，并能妥善处理选择文件夹失败的分支", async () => {
		vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
			download_dir: "C:\\Downloads",
		});

		renderSettings();

		await waitFor(() => {
			expect(screen.getByText("选择目录")).toBeInTheDocument();
		});

		// 1. Directory selection succeeds with value
		vi.mocked(mockSettingsRepository.selectDirectory).mockResolvedValue(
			"D:\\SelectedDir",
		);

		const selectBtn = screen.getByRole("button", { name: "选择目录" });
		fireEvent.click(selectBtn);

		await waitFor(() => {
			expect(screen.getByPlaceholderText(/选择或输入下载路径/)).toHaveValue(
				"D:\\SelectedDir",
			);
			expect(
				screen.getByText("已选择目录，点击保存以生效"),
			).toBeInTheDocument();
		});

		// 2. Directory selection returns null (user cancelled)
		vi.mocked(mockSettingsRepository.selectDirectory).mockResolvedValue(null);

		fireEvent.click(selectBtn);
		expect(screen.getByPlaceholderText(/选择或输入下载路径/)).toHaveValue(
			"D:\\SelectedDir",
		);

		// 3. Directory selection fails
		vi.mocked(mockSettingsRepository.selectDirectory).mockRejectedValueOnce(
			"Native dialog error",
		);

		fireEvent.click(selectBtn);
		await waitFor(() => {
			expect(
				screen.getByText("选择文件夹失败", { exact: false }),
			).toBeInTheDocument();
		});
	});

	it("应该支持点击“重置为默认值”按钮以一键还原默认 Tracker 列表，并能成功保存", async () => {
		vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
			download_dir: "C:\\Downloads",
			trackers: ["udp://oldtracker"],
		});

		renderSettings();

		await waitFor(() => {
			expect(screen.getByPlaceholderText(/请输入 Tracker 地址/)).toHaveValue(
				"udp://oldtracker",
			);
		});

		const resetBtn = screen.getByRole("button", { name: "重置为默认值" });
		fireEvent.click(resetBtn);

		// Expect default trackers list value
		const trackersInput = screen.getByPlaceholderText(
			/请输入 Tracker 地址/,
		) as HTMLTextAreaElement;
		expect(trackersInput.value).toContain(
			"udp://tracker.opentrackr.org:1337/announce",
		);
		expect(trackersInput.value).toContain(
			"http://tracker.openbittorrent.com:80/announce",
		);

		const saveBtn = screen.getByRole("button", { name: "保存设置" });
		fireEvent.click(saveBtn);

		await waitFor(() => {
			expect(mockSettingsRepository.setTrackers).toHaveBeenCalled();
			expect(
				screen.getByText("设置已保存，后续下载任务将使用新路径"),
			).toBeInTheDocument();
		});
	});

	it("应该支持选择不同的 Tracker 列表源和 CDN 节点，并进行在线同步", async () => {
		vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
			download_dir: "C:\\Downloads",
			trackers: ["udp://oldtracker"],
			tracker_source_type: "best",
			tracker_cdn: "jsdelivr",
			tracker_custom_url: "",
			tracker_auto_update: false,
			tracker_last_update_time: 0,
		});

		vi.mocked(mockSettingsRepository.fetchTrackers).mockResolvedValue([
			"udp://newtracker1",
			"http://newtracker2",
		]);

		renderSettings();

		await waitFor(() => {
			expect(screen.getByText("选择列表源")).toBeInTheDocument();
		});

		// Click "立即同步并替换"
		const syncBtn = screen.getByRole("button", { name: /立即同步并替换/ });
		fireEvent.click(syncBtn);

		await waitFor(() => {
			expect(screen.getByPlaceholderText(/请输入 Tracker 地址/)).toHaveValue(
				"udp://newtracker1\nhttp://newtracker2",
			);
			expect(
				screen.getByText(/同步成功：已替换为最新的 2 个 Tracker/),
			).toBeInTheDocument();
		});
	});

	it("当点击返回首页按钮时，应该正常触发路由跳转", async () => {
		vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
			download_dir: "C:\\Downloads",
		});

		renderSettings();

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "返回首页" }),
			).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole("button", { name: "返回首页" }));
		expect(currentLocation.current?.pathname).toBe("/");
	});

	it("应该支持切换不同的 Tracker 列表源与 CDN 加速节点，更改自动更新选项，更改自定义URL，并测试追加同步以及各类失败校验", async () => {
		vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
			download_dir: "C:\\Downloads",
			trackers: ["udp://oldtracker"],
			tracker_source_type: "best",
			tracker_cdn: "jsdelivr",
			tracker_custom_url: "",
			tracker_auto_update: false,
			tracker_last_update_time: 0,
		});

		vi.mocked(mockSettingsRepository.fetchTrackers).mockResolvedValue([
			"udp://newtracker1",
			"http://newtracker2",
		]);

		renderSettings();

		await waitFor(() => {
			expect(screen.getByText("选择列表源")).toBeInTheDocument();
		});

		// 1. 切换列表源预设 (例如：完整列表)
		const allBtn = screen.getByText("完整列表");
		fireEvent.click(allBtn);
		await waitFor(() => {
			expect(allBtn).toHaveClass("bg-primary");
		});

		// 2. 切换 CDN 节点 (例如：GitMirror)
		const mirrorBtn = screen.getByRole("button", { name: /GitMirror/ });
		fireEvent.click(mirrorBtn);
		await waitFor(() => {
			expect(mirrorBtn).toHaveClass("bg-primary");
		});

		// 3. 勾选自动更新
		const autoUpdateCheckbox = screen.getByLabelText(
			"启动时自动更新 (每24小时)",
		);
		fireEvent.click(autoUpdateCheckbox);
		await waitFor(() => {
			expect(autoUpdateCheckbox).toBeChecked();
		});

		// 4. 追加同步按钮点击
		const appendBtn = screen.getByRole("button", { name: /追加同步/ });
		fireEvent.click(appendBtn);

		await waitFor(() => {
			expect(screen.getByPlaceholderText(/请输入 Tracker 地址/)).toHaveValue(
				"udp://oldtracker\nudp://newtracker1\nhttp://newtracker2",
			);
			expect(screen.getByText(/已追加/)).toBeInTheDocument();
		});

		// 5. 切换为自定义源，且自定义 URL 为空时点击同步，应该提示请输入 URL
		const customBtn = screen.getByText("自定义");
		fireEvent.click(customBtn);
		await waitFor(() => {
			expect(customBtn).toHaveClass("bg-primary");
		});

		const syncBtn = screen.getByRole("button", { name: /立即同步并替换/ });
		fireEvent.click(syncBtn);

		await waitFor(() => {
			expect(
				screen.getByText("请输入自定义 Tracker 列表 URL"),
			).toBeInTheDocument();
		});

		// 6. 输入自定义 URL
		const customUrlInput = screen.getByLabelText("自定义 URL 地址");
		fireEvent.change(customUrlInput, {
			target: { value: "https://custom.com/trackers.txt" },
		});
		expect(customUrlInput).toHaveValue("https://custom.com/trackers.txt");

		// 7. 当拉取在线列表铺出异常时，应该进行相应的提示处理
		vi.mocked(mockSettingsRepository.fetchTrackers).mockRejectedValueOnce(
			new Error("Fetch failed"),
		);
		fireEvent.click(syncBtn);

		await waitFor(() => {
			expect(
				screen.getByText(/同步 Tracker 失败: Fetch failed/),
			).toBeInTheDocument();
		});
	});

	it("当同步在线 Tracker 列表返回为空时，应该进行相应的提示处理", async () => {
		vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
			download_dir: "C:\\Downloads",
			trackers: ["udp://oldtracker"],
			tracker_source_type: "best",
			tracker_cdn: "jsdelivr",
			tracker_custom_url: "",
			tracker_auto_update: false,
			tracker_last_update_time: 0,
		});

		vi.mocked(mockSettingsRepository.fetchTrackers).mockResolvedValue([]);

		renderSettings();

		await waitFor(() => {
			expect(screen.getByText("选择列表源")).toBeInTheDocument();
		});

		const syncBtn = screen.getByRole("button", { name: /立即同步并替换/ });
		fireEvent.click(syncBtn);

		await waitFor(() => {
			expect(
				screen.getByText("未获取到有效的 Tracker 地址"),
			).toBeInTheDocument();
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
			expect(screen.getByText("发现新版本 v0.3.2")).toBeInTheDocument();
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
			expect(screen.getAllByText("当前已是最新版本").length).toBeGreaterThan(0);
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
			expect(
				screen.getByText("检查更新失败: 网络连接失败"),
			).toBeInTheDocument();
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
			expect(screen.getByText("发现新版本 v0.3.2")).toBeInTheDocument();
		});

		const downloadBtn = screen.getByRole("button", {
			name: /前往 GitHub 下载/,
		});
		fireEvent.click(downloadBtn);

		await waitFor(() => {
			expect(
				screen.getByText("无法打开链接: 打不开系统默认浏览器"),
			).toBeInTheDocument();
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
			expect(screen.getByText("发现新版本 v0.3.2")).toBeInTheDocument();
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

		render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/settings"]}>
						<LocationTracker />
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route path="settings" element={<Settings />} />
							</Route>
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);

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
			download_dir: "C:\\Downloads",
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
			download_dir: "C:\\Downloads",
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
		await waitFor(() => {
			expect(screen.getByText("请输入 AI 接口地址")).toBeInTheDocument();
		});

		// 2. 密钥为空
		const endpointInput = screen.getByLabelText(
			"AI 接口地址 (Endpoint) *",
		) as HTMLInputElement;
		fireEvent.change(endpointInput, {
			target: { value: "https://api.openai.com/v1" },
		});

		fireEvent.click(testBtn);
		await waitFor(() => {
			expect(screen.getByText("请输入 API 密钥")).toBeInTheDocument();
		});
	});

	it("应该支持在 AI 设置面板中测试模型连接并展示成功提示", async () => {
		vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
			download_dir: "C:\\Downloads",
			ai_configs: [
				{
					alias: "OpenAI",
					api_endpoint: "https://api.openai.com/v1",
					api_key: "my-secret-key",
					ai_model: "gpt-4o",
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
			expect(screen.getByText("AI 模型连接测试成功！")).toBeInTheDocument();
		});
	});

	it("应该支持在 AI 设置面板中测试模型连接并展示失败提示", async () => {
		vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
			download_dir: "C:\\Downloads",
			ai_configs: [
				{
					alias: "OpenAI",
					api_endpoint: "https://api.openai.com/v1",
					api_key: "my-secret-key",
					ai_model: "gpt-4o",
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
			expect(
				screen.getByText(/AI 模型连接测试失败: API Error/),
			).toBeInTheDocument();
		});
	});

	it("在 AI 设置面板中，应该支持测试当前正在编辑的配置连接", async () => {
		vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
			download_dir: "C:\\Downloads",
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

		const endpointInput = screen.getByLabelText(
			"AI 接口地址 (Endpoint) *",
		) as HTMLInputElement;
		const keyInput = screen.getByLabelText(
			"API 密钥 (API Key) *",
		) as HTMLInputElement;

		fireEvent.change(endpointInput, {
			target: { value: "https://api.test-form.com" },
		});
		fireEvent.change(keyInput, { target: { value: "form-key" } });

		const testBtn = screen.getByRole("button", { name: "测试模型连接" });
		fireEvent.click(testBtn);

		await waitFor(() => {
			expect(mockAiClient.post).toHaveBeenCalledWith(
				"https://api.test-form.com",
				"form-key",
				expect.any(Object),
			);
			expect(screen.getByText("AI 模型连接测试成功！")).toBeInTheDocument();
		});
	});

	it("应该支持对已添加的 AI 配置进行编辑、取消编辑以及保存修改", async () => {
		vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
			download_dir: "C:\\Downloads",
			ai_configs: [
				{
					alias: "OpenAI",
					api_endpoint: "https://api.openai.com/v1",
					api_key: "old-key",
					ai_model: "gpt-4o",
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
			download_dir: "C:\\Downloads",
			ai_configs: [
				{
					alias: "Config1",
					api_endpoint: "https://api1.com",
					api_key: "key1",
					ai_model: "model1",
				},
				{
					alias: "Config2",
					api_endpoint: "https://api2.com",
					api_key: "key2",
					ai_model: "model2",
				},
				{
					alias: "Config3",
					api_endpoint: "https://api3.com",
					api_key: "key3",
					ai_model: "model3",
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

		fireEvent.change(aliasInput, { target: { value: "NewConfig" } });
		fireEvent.change(endpointInput, {
			target: { value: "https://apinew.com" },
		});
		fireEvent.change(keyInput, { target: { value: "keynew" } });
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
					ai_model: null,
				},
			]);
		});
	});

	it("添加/保存配置时应该有相应的表单字段及重复校验警告", async () => {
		vi.mocked(mockSettingsRepository.getSettings).mockResolvedValue({
			download_dir: "C:\\Downloads",
			ai_configs: [
				{
					alias: "OpenAI",
					api_endpoint: "https://api.openai.com/v1",
					api_key: "my-key",
					ai_model: "gpt-4o",
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
		await waitFor(() => {
			expect(screen.getByText("请输入别名")).toBeInTheDocument();
		});

		// 2. 空接口
		fireEvent.change(aliasInput, { target: { value: "NewAlias" } });
		fireEvent.click(saveBtn);
		await waitFor(() => {
			expect(screen.getByText("请输入接口地址")).toBeInTheDocument();
		});

		// 3. 空密钥
		fireEvent.change(endpointInput, {
			target: { value: "https://api.new.com" },
		});
		fireEvent.click(saveBtn);
		await waitFor(() => {
			expect(screen.getByText("请输入 API 密钥")).toBeInTheDocument();
		});

		// 4. 重复别名
		fireEvent.change(keyInput, { target: { value: "new-key" } });
		fireEvent.change(aliasInput, { target: { value: "OpenAI" } }); // OpenAI is duplicate
		fireEvent.click(saveBtn);
		await waitFor(() => {
			expect(
				screen.getByText("该别名已存在，请使用其他别名"),
			).toBeInTheDocument();
		});
	});

	it("应该支持选择不同的界面主题并应用", async () => {
		renderSettings();

		await waitFor(() => {
			expect(screen.getByText("外观设置")).toBeInTheDocument();
		});

		const systemBtn = screen.getByRole("button", { name: "跟随系统" });
		const lightBtn = screen.getByRole("button", { name: "浅色模式" });
		const darkBtn = screen.getByRole("button", { name: "深色模式" });

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
});

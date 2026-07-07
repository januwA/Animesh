import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
			fetchTrackers: vi.fn(),
			selectDirectory: vi.fn(),
		};

		mockContainer = createDIContainerForTest({
			settingsRepository: mockSettingsRepository,
		});

		currentLocation.current = null;
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const renderSettings = () => {
		return render(
			<DIProvider value={mockContainer}>
				<AppContextProvider>
					<MemoryRouter initialEntries={["/settings"]}>
						<LocationTracker />
						<Routes>
							<Route path="/" element={<Layout />}>
								<Route path="settings" element={<Settings />} />
							</Route>
							<Route path="/" element={<div>Home Page</div>} />
						</Routes>
					</MemoryRouter>
				</AppContextProvider>
			</DIProvider>,
		);
	};

	it("应该在加载时渲染加载指示器", async () => {
		vi.mocked(mockSettingsRepository.getSettings).mockImplementation(
			() => new Promise(() => {}),
		);

		renderSettings();

		expect(screen.getByText("正在加载设置面版...")).toBeInTheDocument();
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
});

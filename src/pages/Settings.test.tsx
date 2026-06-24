import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import Layout from "../components/Layout";
import { AppContextProvider } from "../context/AppContext";
import type { DIContainer } from "../di/DIContext";
import { createDIContainer, DIProvider } from "../di/DIContext";
import type { SettingsRepository } from "../domain/settings/SettingsRepository";
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
			getSettings: vi.fn(),
			setDownloadDir: vi.fn(),
			selectDirectory: vi.fn(),
		};

		mockContainer = createDIContainer({
			torrentRepository: {
				searchDmhy: vi.fn(),
				addTorrentMagnet: vi.fn(),
				getTorrentFiles: vi.fn(),
				listTorrents: vi.fn(),
				pauseTorrent: vi.fn(),
				resumeTorrent: vi.fn(),
				deleteTorrent: vi.fn(),
				getTorrentStreamUrl: vi.fn(),
				getTorrentStatus: vi.fn(),
				getSubtitleTracks: vi.fn(),
				getSubtitleVtt: vi.fn(),
			},
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
			expect(screen.getByText("加载设置失败")).toBeInTheDocument();
		});
	});

	it("应该成功加载并显示当前下载目录，且支持输入更改与保存（成功分支）", async () => {
		let currentDir = "C:\\Downloads";

		vi.mocked(mockSettingsRepository.getSettings).mockImplementation(
			async () => {
				return { download_dir: currentDir };
			},
		);
		vi.mocked(mockSettingsRepository.setDownloadDir).mockImplementation(
			async (dir) => {
				currentDir = dir;
			},
		);

		renderSettings();

		await waitFor(() => {
			expect(screen.getByPlaceholderText(/选择或输入下载路径/)).toHaveValue(
				"C:\\Downloads",
			);
		});

		const input = screen.getByPlaceholderText(/选择或输入下载路径/);
		fireEvent.change(input, { target: { value: "E:\\NewDownloads" } });

		const saveBtn = screen.getByRole("button", { name: "保存设置" });
		fireEvent.click(saveBtn);

		await waitFor(() => {
			expect(mockSettingsRepository.setDownloadDir).toHaveBeenCalledWith(
				"E:\\NewDownloads",
			);
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
			expect(screen.getByText("Path not writeable")).toBeInTheDocument();
		});

		// 2. Non-string error (Error object)
		vi.mocked(mockSettingsRepository.setDownloadDir).mockRejectedValueOnce(
			new Error("Permission Denied"),
		);

		fireEvent.click(saveBtn);
		await waitFor(() => {
			expect(
				screen.getByText("保存路径失败，请检查路径是否合法或是否有写权限"),
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
			expect(screen.getByText("选择文件夹失败")).toBeInTheDocument();
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
});

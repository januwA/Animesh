import {
	Download,
	Folder,
	Globe,
	HardDrive,
	Info,
	Lightbulb,
	Link2,
	Loader2,
	RefreshCw,
	Save,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import { SettingsFormSchema } from "@/domain/settings/SettingsSchemas";
import {
	getTrackerUrl,
	type TrackerCdnType,
	type TrackerSourceType,
} from "@/domain/settings/TrackerSettings";
import type { UpdateCheckResult } from "@/domain/update/UpdateInfo";
import { Button } from "@/presentation/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/presentation/components/ui/card";
import { Input } from "@/presentation/components/ui/input";
import { formatError, formatLocalDate } from "@/utils";
import { useAppContext } from "../context/AppContext";

export default function Settings() {
	const navigate = useNavigate();
	const {
		getSettingsUseCase,
		saveSettingsUseCase,
		selectDirectoryUseCase,
		syncTrackersUseCase,
		checkUpdateUseCase,
		getCurrentVersionUseCase,
		openUpdateUrlUseCase,
	} = useDI();
	const { showToast } = useAppContext();
	const [currentVersion, setCurrentVersion] = useState("");
	const [checkingUpdate, setCheckingUpdate] = useState(false);
	const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(
		null,
	);
	const [downloadDir, setDownloadDir] = useState("");
	const [proxy, setProxy] = useState("");
	const [trackersText, setTrackersText] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const [sourceType, setSourceType] = useState<TrackerSourceType>("best");
	const [cdn, setCdn] = useState<TrackerCdnType>("jsdelivr");
	const [customUrl, setCustomUrl] = useState("");
	const [autoUpdate, setAutoUpdate] = useState(false);
	const [lastUpdateTime, setLastUpdateTime] = useState(0);
	const [syncing, setSyncing] = useState(false);

	const currentUrl = getTrackerUrl(sourceType, cdn, customUrl);

	const handleSync = async (mode: "replace" | "append") => {
		if (sourceType === "custom" && !customUrl) {
			showToast("请输入自定义 Tracker 列表 URL");
			return;
		}

		setSyncing(true);
		try {
			const url = getTrackerUrl(sourceType, cdn, customUrl);
			const fetched = await syncTrackersUseCase.execute(url);

			if (fetched.length === 0) {
				showToast("未获取到有效的 Tracker 地址");
				return;
			}

			if (mode === "replace") {
				setTrackersText(fetched.join("\n"));
				showToast(
					`同步成功：已替换为最新的 ${fetched.length} 个 Tracker，请保存设置`,
				);
			} else {
				const currentTrackers = trackersText
					.split("\n")
					.map((t) => t.trim())
					.filter((t) => t.length > 0);
				const merged = Array.from(new Set([...currentTrackers, ...fetched]));
				setTrackersText(merged.join("\n"));
				const addedCount = merged.length - currentTrackers.length;
				showToast(
					`同步成功：已追加 ${addedCount} 个新 Tracker (共计 ${merged.length} 个)，请保存设置`,
				);
			}

			const now = Date.now();
			setLastUpdateTime(now);
		} catch (err: unknown) {
			showToast(`同步 Tracker 失败: ${formatError(err)}`);
		} finally {
			setSyncing(false);
		}
	};

	const isMobile =
		["android", "ios"].includes(import.meta.env.TAURI_ENV_PLATFORM || "") ||
		(typeof navigator !== "undefined" &&
			/android|iphone|ipad|ipod/i.test(navigator.userAgent));

	// Load settings
	useEffect(() => {
		const loadSettings = async () => {
			try {
				const settings = await getSettingsUseCase.execute();
				setDownloadDir(settings.download_dir);
				setProxy(settings.proxy || "");
				setTrackersText((settings.trackers || []).join("\n"));
				setSourceType(
					(settings.tracker_source_type || "best") as TrackerSourceType,
				);
				setCdn((settings.tracker_cdn || "jsdelivr") as TrackerCdnType);
				setCustomUrl(settings.tracker_custom_url || "");
				setAutoUpdate(settings.tracker_auto_update === true);
				setLastUpdateTime(settings.tracker_last_update_time || 0);
			} catch (err: unknown) {
				showToast(`加载设置失败: ${formatError(err)}`);
			} finally {
				setLoading(false);
			}
		};
		loadSettings();
	}, [showToast, getSettingsUseCase]);

	// Load version
	useEffect(() => {
		const loadVersion = async () => {
			const version = await getCurrentVersionUseCase.execute();
			setCurrentVersion(version);
		};
		loadVersion();
	}, [getCurrentVersionUseCase]);

	const handleCheckUpdate = async () => {
		setCheckingUpdate(true);
		setUpdateResult(null);
		try {
			const result = await checkUpdateUseCase.execute();
			setUpdateResult(result);
			if (result.hasUpdate) {
				showToast(`发现新版本 v${result.latestVersion}`);
			} else {
				showToast("当前已是最新版本");
			}
		} catch (err: unknown) {
			showToast(`检查更新失败: ${formatError(err)}`);
		} finally {
			setCheckingUpdate(false);
		}
	};

	// Handle native directory selection
	const handleSelectDir = async () => {
		try {
			const selected = await selectDirectoryUseCase.execute();
			if (selected) {
				setDownloadDir(selected);
				showToast("已选择目录，点击保存以生效");
			}
		} catch (err: unknown) {
			showToast(`选择文件夹失败: ${formatError(err)}`);
		}
	};

	// Save settings
	const handleSave = async (e: React.SubmitEvent) => {
		e.preventDefault();

		const parsedTrackers = trackersText
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);

		const validation = SettingsFormSchema.safeParse({
			downloadDir,
			proxy,
			trackers: parsedTrackers,
			trackerSourceType: sourceType,
			trackerCdn: cdn,
			trackerCustomUrl: customUrl,
			trackerAutoUpdate: autoUpdate,
			trackerLastUpdateTime: lastUpdateTime,
		});

		if (!validation.success) {
			const firstError = validation.error.issues[0].message;
			showToast(firstError);
			return;
		}

		const validatedData = validation.data;

		setSaving(true);
		try {
			await saveSettingsUseCase.execute({
				downloadDir: validatedData.downloadDir,
				proxy: validatedData.proxy,
				trackers: validatedData.trackers,
				trackerSourceType: validatedData.trackerSourceType,
				trackerCdn: validatedData.trackerCdn,
				trackerCustomUrl: validatedData.trackerCustomUrl,
				trackerAutoUpdate: validatedData.trackerAutoUpdate,
				trackerLastUpdateTime: validatedData.trackerLastUpdateTime,
			});
			showToast("设置已保存，后续下载任务将使用新路径");
		} catch (err: unknown) {
			showToast(`保存路径失败: ${formatError(err)}`, 5000);
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center py-20 space-y-4">
				<Loader2 className="h-10 w-10 text-primary animate-spin" />
				<p className="text-sm text-muted-foreground font-medium">
					正在加载设置面版...
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Settings Form */}
			<form onSubmit={handleSave}>
				<Card className="bg-card/40 border-white/5">
					<CardHeader className="p-5">
						<CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
							<HardDrive className="h-4 w-4 text-primary" />
							存储设置 (BT 下载及缓存目录)
						</CardTitle>
					</CardHeader>
					<CardContent className="px-5 pb-6 space-y-4 text-xs">
						<div className="space-y-2">
							<label
								htmlFor="download-dir-input"
								className="text-muted-foreground font-medium"
							>
								默认下载及播放缓存目录
							</label>
							<div className="flex gap-2">
								<Input
									id="download-dir-input"
									value={downloadDir}
									disabled={isMobile}
									onChange={(e) => setDownloadDir(e.target.value)}
									placeholder={
										isMobile
											? "应用沙盒内部路径"
											: "选择或输入下载路径，例如 D:\\AnimeshDownloads"
									}
									className="flex-1 bg-black/20 border-white/10 text-foreground py-5 text-xs disabled:opacity-80"
								/>
								{!isMobile && (
									<Button
										type="button"
										variant="secondary"
										onClick={handleSelectDir}
										className="gap-1.5 h-10.5 font-medium px-4 text-xs"
									>
										<Folder className="h-4 w-4" />
										选择目录
									</Button>
								)}
							</div>
							<p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-1 flex flex-col gap-1.5">
								{isMobile ? (
									<span className="flex items-center gap-1">
										<Info className="h-3.5 w-3.5 text-primary shrink-0" />
										移动端（Android/iOS）已自动选用应用沙盒内部路径，无需且不支持手动更改。
									</span>
								) : (
									<span className="flex items-start gap-1">
										<Lightbulb className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
										<span>
											提示：边下边播的缓存与下载的完整文件均保存在该路径下。建议选择剩余空间较大的磁盘分区（非系统C盘），以防空间不足导致播放异常。
										</span>
									</span>
								)}
							</p>
						</div>
					</CardContent>
				</Card>

				<Card className="bg-card/40 border-white/5">
					<CardHeader className="p-5">
						<CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
							<Globe className="h-4 w-4 text-primary" />
							网络设置
						</CardTitle>
					</CardHeader>
					<CardContent className="px-5 pb-6 space-y-4 text-xs">
						<div className="space-y-2">
							<label
								htmlFor="proxy-input"
								className="text-muted-foreground font-medium"
							>
								代理服务器地址
							</label>
							<Input
								id="proxy-input"
								value={proxy}
								onChange={(e) => setProxy(e.target.value)}
								placeholder="例如 http://127.0.0.1:7890 或 socks5://127.0.0.1:7890 (留空则不使用代理)"
								className="bg-black/20 border-white/10 text-foreground py-5 text-xs"
							/>
							<p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-1 flex items-start gap-1">
								<Lightbulb className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
								<span>
									提示：部分地区可能有网络问题 搜索无结果，可配置代理。支持
									HTTP、HTTPS 或 SOCKS5 代理。
								</span>
							</p>
						</div>
					</CardContent>
				</Card>

				<Card className="bg-card/40 border-white/5">
					<CardHeader className="p-5">
						<CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
							<Info className="h-4 w-4 text-primary" />
							检查更新
						</CardTitle>
					</CardHeader>
					<CardContent className="px-5 pb-6 space-y-4 text-xs">
						<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-white/5 bg-black/10 rounded-lg p-4">
							<div className="space-y-1">
								<p className="font-semibold text-foreground">Animesh 客户端</p>
								<p className="text-muted-foreground">
									当前版本：{currentVersion || "加载中..."}
								</p>
							</div>
							<div className="flex gap-2">
								<Button
									type="button"
									variant="outline"
									disabled={checkingUpdate}
									onClick={handleCheckUpdate}
									className="text-xs h-8.5 font-medium border-white/10 bg-black/10 text-foreground hover:bg-black/20"
								>
									{checkingUpdate ? (
										<Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
									) : (
										<RefreshCw className="h-3.5 w-3.5 mr-1.5" />
									)}
									检查更新
								</Button>
							</div>
						</div>

						{updateResult && (
							<div className="border border-white/5 bg-black/20 rounded-lg p-4 space-y-3">
								<div className="flex items-center justify-between">
									<h4 className="text-xs font-semibold text-foreground">
										{updateResult.hasUpdate
											? "发现新版本！"
											: "当前已是最新版本"}
									</h4>
									{updateResult.hasUpdate && (
										<span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full font-medium">
											v{updateResult.latestVersion}
										</span>
									)}
								</div>

								{updateResult.hasUpdate && (
									<>
										<p className="text-muted-foreground/90 whitespace-pre-wrap leading-relaxed">
											{updateResult.notes}
										</p>
										<div className="flex gap-2 pt-1">
											<Button
												type="button"
												onClick={async () => {
													if (updateResult.htmlUrl) {
														try {
															await openUpdateUrlUseCase.execute(
																updateResult.htmlUrl,
															);
														} catch (err: unknown) {
															showToast(`无法打开链接: ${formatError(err)}`);
														}
													}
												}}
												className="text-xs h-8 font-medium px-3 bg-primary text-primary-foreground"
											>
												前往 GitHub 下载
											</Button>
										</div>
									</>
								)}
							</div>
						)}
					</CardContent>
				</Card>

				<Card className="bg-card/40 border-white/5">
					<CardHeader className="p-5">
						<CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
							<Link2 className="h-4 w-4 text-primary" />
							BT Trackers 设置 (加速磁力解析与下载)
						</CardTitle>
					</CardHeader>
					<CardContent className="px-5 pb-6 space-y-4 text-xs">
						{/* Tracker Online Sync & Enhancement Section */}
						<div className="border border-white/5 bg-black/10 rounded-lg p-4 space-y-4 mb-6">
							<div className="flex items-center justify-between border-b border-white/5 pb-2">
								<h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
									<Globe className="h-3.5 w-3.5 text-primary" />
									在线同步与自动更新 (ngosang/trackerslist)
								</h4>
								<span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
									每日自动同步
								</span>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* Left side: Configs */}
								<div className="space-y-3.5">
									{/* Source Type Selection */}
									<div className="space-y-1.5">
										<span className="text-[11px] text-muted-foreground font-medium">
											选择列表源
										</span>
										<div className="flex flex-wrap gap-1">
											{(
												["best", "all", "best_ip", "all_ip", "custom"] as const
											).map((type) => {
												const labels: Record<string, string> = {
													best: "最优列表 (推荐)",
													all: "完整列表",
													best_ip: "最优 IP",
													all_ip: "完整 IP",
													custom: "自定义",
												};
												const isActive = sourceType === type;
												return (
													<button
														key={type}
														type="button"
														onClick={() => setSourceType(type)}
														className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all duration-150 ${
															isActive
																? "bg-primary border-primary text-primary-foreground shadow-[0_0_10px_rgba(var(--primary),0.2)]"
																: "bg-black/20 border-white/5 text-muted-foreground hover:bg-black/30 hover:text-foreground"
														}`}
													>
														{labels[type]}
													</button>
												);
											})}
										</div>
									</div>

									{/* CDN Selection */}
									{sourceType !== "custom" && (
										<div className="space-y-1.5">
											<span className="text-[11px] text-muted-foreground font-medium">
												CDN 加速节点
											</span>
											<div className="flex flex-wrap gap-1">
												{(["jsdelivr", "gitmirror", "github"] as const).map(
													(cdnType) => {
														const labels: Record<string, string> = {
															jsdelivr: "jsDelivr 加速)",
															gitmirror: "GitMirror (镜像)",
															github: "GitHub (原始)",
														};
														const isActive = cdn === cdnType;
														return (
															<button
																key={cdnType}
																type="button"
																onClick={() => setCdn(cdnType)}
																className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all duration-150 ${
																	isActive
																		? "bg-primary border-primary text-primary-foreground shadow-[0_0_10px_rgba(var(--primary),0.2)]"
																		: "bg-black/20 border-white/5 text-muted-foreground hover:bg-black/30 hover:text-foreground"
																}`}
															>
																{labels[cdnType]}
															</button>
														);
													},
												)}
											</div>
										</div>
									)}

									{/* Auto Update Checkbox */}
									<div className="flex items-center gap-2 pt-1">
										<input
											id="auto-update-checkbox"
											type="checkbox"
											checked={autoUpdate}
											onChange={(e) => setAutoUpdate(e.target.checked)}
											className="h-3.5 w-3.5 rounded border-white/10 bg-black/20 text-primary focus:ring-primary focus:ring-offset-0 accent-primary"
										/>
										<label
											htmlFor="auto-update-checkbox"
											className="text-[11px] text-foreground font-medium cursor-pointer select-none"
										>
											启动时自动更新 (每24小时)
										</label>
									</div>
								</div>

								{/* Right side: Input URL & Sync actions */}
								<div className="flex flex-col justify-between space-y-3">
									<div className="space-y-1.5">
										<label
											htmlFor="tracker-url-input"
											className="text-[11px] text-muted-foreground font-medium"
										>
											{sourceType === "custom"
												? "自定义 URL 地址"
												: "当前解析同步地址"}
										</label>
										<Input
											id="tracker-url-input"
											value={sourceType === "custom" ? customUrl : currentUrl}
											onChange={(e) => {
												setCustomUrl(e.target.value);
											}}
											disabled={sourceType !== "custom"}
											placeholder="引导地址例如 https://example.com/trackers.txt"
											className="bg-black/20 border-white/10 text-foreground py-2 text-[11px] h-8"
										/>
									</div>

									{/* Sync actions */}
									<div className="space-y-2">
										<div className="flex gap-2">
											<Button
												type="button"
												variant="secondary"
												disabled={syncing}
												onClick={() => handleSync("replace")}
												className="flex-1 text-[11px] h-8.5 font-medium gap-1.5"
											>
												{syncing ? (
													<Loader2 className="h-3.5 w-3.5 animate-spin" />
												) : (
													<RefreshCw className="h-3.5 w-3.5" />
												)}
												立即同步并替换
											</Button>
											<Button
												type="button"
												variant="outline"
												disabled={syncing}
												onClick={() => handleSync("append")}
												className="flex-1 text-[11px] h-8.5 font-medium gap-1.5 border-white/10 bg-black/10 text-foreground hover:bg-black/20"
											>
												<Download className="h-3.5 w-3.5" />
												追加同步
											</Button>
										</div>

										<div className="flex items-center justify-between text-[10px] text-muted-foreground/80 px-0.5">
											<span>最后更新时间：</span>
											<span className="font-mono">
												{lastUpdateTime
													? formatLocalDate(lastUpdateTime)
													: "从未更新"}
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>

						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<label
									htmlFor="trackers-input"
									className="text-muted-foreground font-medium"
								>
									Tracker 服务器列表 (每行一个)
								</label>
								<button
									type="button"
									onClick={() => {
										setTrackersText(
											[
												"udp://tracker.opentrackr.org:1337/announce",
												"http://tracker.gbitt.info:80/announce",
												"udp://open.stealth.si:80/announce",
												"udp://tracker.coppersurfer.tk:6969/announce",
												"udp://exodus.desync.com:6969/announce",
												"udp://tracker.leechers-paradise.org:6969/announce",
												"udp://tracker.internetwarriors.net:1337/announce",
												"udp://tracker.cyberia.is:6969/announce",
												"udp://tracker.torrent.eu.org:451/announce",
												"udp://tracker.moack.co.kr:80/announce",
												"udp://explodie.org:6969/announce",
												"http://tracker.openbittorrent.com:80/announce",
											].join("\n"),
										);
										showToast("已重置为默认 Tracker 列表，点击保存生效");
									}}
									className="text-[11px] text-primary hover:underline font-medium"
								>
									重置为默认值
								</button>
							</div>
							<textarea
								id="trackers-input"
								value={trackersText}
								onChange={(e) => setTrackersText(e.target.value)}
								placeholder="请输入 Tracker 地址，每行输入一个"
								rows={8}
								className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
							/>
							<p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-1 flex items-start gap-1">
								<Lightbulb className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
								<span>
									提示：添加高质量的公网 Tracker
									可以极大地加快纯净磁力链接的解析速度，并帮助你更快地连接到
									Peers。
								</span>
							</p>
						</div>

						{/* Action buttons */}
						<div className="flex justify-end gap-3 pt-4 border-t border-white/5">
							<Button
								type="button"
								variant="ghost"
								onClick={() => navigate("/")}
								className="text-xs font-medium"
							>
								返回首页
							</Button>
							<Button
								type="submit"
								disabled={saving}
								className="gap-1.5 text-xs font-medium px-5"
							>
								{saving ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<Save className="h-3.5 w-3.5" />
								)}
								保存设置
							</Button>
						</div>
					</CardContent>
				</Card>
			</form>
		</div>
	);
}

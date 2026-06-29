import { Folder, Globe, HardDrive, Link2, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAppContext } from "../context/AppContext";
import { useDI } from "../di/DIContext";
import { SettingsFormSchema } from "../domain/settings/SettingsSchemas";

export default function Settings() {
	const navigate = useNavigate();
	const { getSettingsUseCase, saveSettingsUseCase, selectDirectoryUseCase } =
		useDI();
	const { showToast } = useAppContext();
	const [downloadDir, setDownloadDir] = useState("");
	const [proxy, setProxy] = useState("");
	const [trackersText, setTrackersText] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	// Load settings
	useEffect(() => {
		const loadSettings = async () => {
			try {
				const settings = await getSettingsUseCase.execute();
				setDownloadDir(settings.download_dir);
				setProxy(settings.proxy || "");
				setTrackersText((settings.trackers || []).join("\n"));
			} catch (_err: unknown) {
				showToast("加载设置失败");
			} finally {
				setLoading(false);
			}
		};
		loadSettings();
	}, [showToast, getSettingsUseCase]);

	// Handle native directory selection
	const handleSelectDir = async () => {
		try {
			const selected = await selectDirectoryUseCase.execute();
			if (selected) {
				setDownloadDir(selected);
				showToast("已选择目录，点击保存以生效");
			}
		} catch (_err: unknown) {
			showToast("选择文件夹失败");
		}
	};

	// Save settings
	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();

		const parsedTrackers = trackersText
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);

		const validation = SettingsFormSchema.safeParse({
			downloadDir,
			proxy,
			trackers: parsedTrackers,
		});

		if (!validation.success) {
			const firstError = validation.error.issues[0]?.message || "格式不正确";
			showToast(firstError);
			return;
		}

		const validatedData = validation.data;

		setSaving(true);
		try {
			await saveSettingsUseCase.execute(
				validatedData.downloadDir,
				validatedData.proxy,
				validatedData.trackers,
			);
			showToast("设置已保存，后续下载任务将使用新路径");
		} catch (err: unknown) {
			const errMsg =
				typeof err === "string"
					? err
					: "保存路径失败，请检查路径是否合法或是否有写权限";
			showToast(errMsg, 5000);
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
			{/* Page Header */}
			<div className="flex items-center justify-between border-b border-white/5 pb-4">
				<div>
					<h2 className="text-xl font-bold text-foreground flex items-center gap-2">
						⚙️ 设置选项
					</h2>
					<p className="text-xs text-muted-foreground mt-1">
						配置软件全局选项，如缓存目录和存储大小
					</p>
				</div>
			</div>

			{/* Settings Form */}
			<form onSubmit={handleSave} className="space-y-4">
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
									onChange={(e) => setDownloadDir(e.target.value)}
									placeholder="选择或输入下载路径，例如 D:\AnimeshDownloads"
									className="flex-1 bg-black/20 border-white/10 text-foreground py-5 text-xs"
								/>
								<Button
									type="button"
									variant="secondary"
									onClick={handleSelectDir}
									className="gap-1.5 h-10.5 font-medium px-4 text-xs"
								>
									<Folder className="h-4 w-4" />
									选择目录
								</Button>
							</div>
							<p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-1">
								💡
								提示：边下边播的缓存与下载的完整文件均保存在该路径下。建议选择剩余空间较大的磁盘分区（非系统C盘），以防空间不足导致播放异常。
							</p>
						</div>
					</CardContent>
				</Card>

				<Card className="bg-card/40 border-white/5">
					<CardHeader className="p-5">
						<CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
							<Globe className="h-4 w-4 text-primary" />
							网络设置 (动漫花园代理)
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
							<p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-1">
								💡 提示：部分地区可能无法直接访问动漫花园。如果 RSS
								搜索无结果，可配置代理。支持 HTTP、HTTPS 或 SOCKS5 代理。
							</p>
						</div>
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
							<p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-1">
								💡 提示：添加高质量的公网 Tracker
								可以极大地加快纯净磁力链接的解析速度，并帮助你更快地连接到
								Peers。
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

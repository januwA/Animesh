import { Folder, HardDrive, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAppContext } from "../context/AppContext";
import { useDI } from "../di/DIContext";

export default function Settings() {
	const navigate = useNavigate();
	const { settingsRepository } = useDI();
	const { showToast } = useAppContext();
	const [downloadDir, setDownloadDir] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	// Load settings
	useEffect(() => {
		const loadSettings = async () => {
			try {
				const settings = await settingsRepository.getSettings();
				setDownloadDir(settings.download_dir);
			} catch (err: unknown) {
				console.error("Failed to load settings:", err);
				showToast("加载设置失败");
			} finally {
				setLoading(false);
			}
		};
		loadSettings();
	}, [showToast, settingsRepository]);

	// Handle native directory selection
	const handleSelectDir = async () => {
		try {
			const selected = await settingsRepository.selectDirectory();
			if (selected) {
				setDownloadDir(selected);
				showToast("已选择目录，点击保存以生效");
			}
		} catch (err: unknown) {
			console.error("Failed to select directory:", err);
			showToast("选择文件夹失败");
		}
	};

	// Save settings
	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!downloadDir.trim()) {
			showToast("下载目录不能为空");
			return;
		}

		setSaving(true);
		try {
			await settingsRepository.setDownloadDir(downloadDir.trim());
			showToast("设置已保存，后续下载任务将使用新路径");
		} catch (err: unknown) {
			console.error("Failed to save settings:", err);
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

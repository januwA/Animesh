import {
	Activity,
	Download,
	FolderOpen,
	HardDrive,
	Loader2,
	Pause,
	Play,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useAppContext } from "../context/AppContext";
import { useDI } from "../di/DIContext";
import type { TorrentStatusInfo } from "../types";
import { formatBytes } from "../utils";

export default function Downloads() {
	const navigate = useNavigate();
	const {
		listTorrentsUseCase,
		pauseTorrentUseCase,
		resumeTorrentUseCase,
		deleteTorrentUseCase,
	} = useDI();
	const { showToast } = useAppContext();
	const [torrents, setTorrents] = useState<TorrentStatusInfo[]>([]);
	const [loading, setLoading] = useState(true);

	// Deletion state
	const [deleteTarget, setDeleteTarget] = useState<TorrentStatusInfo | null>(
		null,
	);
	const [deleteFiles, setDeleteFiles] = useState(false);
	const [deleting, setDeleting] = useState(false);

	// Fetch torrents function
	const fetchTorrents = useCallback(
		async (isInitial = false) => {
			try {
				const list = await listTorrentsUseCase.execute();
				setTorrents(list);
				if (isInitial) {
					setLoading(false);
				}
			} catch (err: unknown) {
				console.error("Failed to fetch torrent list:", err);
				if (isInitial) {
					showToast("获取下载列表失败");
					setLoading(false);
				}
			}
		},
		[showToast, listTorrentsUseCase],
	);

	// Polling downloads list
	useEffect(() => {
		fetchTorrents(true);
		const interval = setInterval(() => {
			fetchTorrents();
		}, 1500);

		return () => clearInterval(interval);
	}, [fetchTorrents]);

	// Pause a download
	const handlePause = async (infoHash: string, name: string) => {
		try {
			await pauseTorrentUseCase.execute(infoHash);
			showToast(`已暂停任务: ${name || infoHash.slice(0, 8)}`);
			fetchTorrents();
		} catch (err: unknown) {
			console.error("Failed to pause torrent:", err);
			showToast("暂停失败，请重试");
		}
	};

	// Resume a download
	const handleResume = async (infoHash: string, name: string) => {
		try {
			await resumeTorrentUseCase.execute(infoHash);
			showToast(`已开始下载任务: ${name || infoHash.slice(0, 8)}`);
			fetchTorrents();
		} catch (err: unknown) {
			console.error("Failed to resume torrent:", err);
			showToast("启动失败，请重试");
		}
	};

	// Delete a download
	const handleDelete = async () => {
		if (!deleteTarget) return;
		setDeleting(true);
		try {
			await deleteTorrentUseCase.execute(deleteTarget.info_hash, deleteFiles);
			showToast(
				`已删除任务${deleteFiles ? "及本地文件" : ""}: ${deleteTarget.name || deleteTarget.info_hash.slice(0, 8)}`,
			);
			setDeleteTarget(null);
			fetchTorrents();
		} catch (err: unknown) {
			console.error("Failed to delete torrent:", err);
			showToast("删除任务失败，请重试");
		} finally {
			setDeleting(false);
		}
	};

	const handleViewFiles = (torrent: TorrentStatusInfo) => {
		navigate(
			`/torrent?infoHash=${torrent.info_hash}&title=${encodeURIComponent(torrent.name || "未命名种子")}`,
		);
	};

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center py-20 space-y-4">
				<Loader2 className="h-10 w-10 text-primary animate-spin" />
				<p className="text-sm text-muted-foreground font-medium">
					正在加载下载管理器...
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
						📥 下载管理
					</h2>
					<p className="text-xs text-muted-foreground mt-1">
						管理所有在后台进行的种子下载与边下边播任务
					</p>
				</div>
				<Badge variant="secondary" className="px-2.5 py-1">
					全部任务: {torrents.length}
				</Badge>
			</div>

			{/* Empty State */}
			{torrents.length === 0 ? (
				<Card className="bg-card/30 border-white/5 py-16 text-center">
					<CardContent className="space-y-4">
						<div className="text-4xl text-muted-foreground/60 select-none">
							📥
						</div>
						<div className="space-y-1">
							<h3 className="text-sm font-semibold text-foreground">
								没有正在进行的下载任务
							</h3>
							<p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
								您可以在首页搜索动漫花园的资源，点击“边下边播”或者“复制磁力”解析后开始下载。
							</p>
						</div>
						<Button onClick={() => navigate("/")} size="sm" className="mt-2">
							前往搜索视频
						</Button>
					</CardContent>
				</Card>
			) : (
				/* Download Cards List */
				<div className="grid gap-4">
					{torrents.map((t) => {
						const progress = t.total_bytes
							? (t.progress_bytes / t.total_bytes) * 100
							: 0;
						return (
							<Card
								key={t.info_hash}
								className="bg-card/40 hover:bg-card-hover/50 border-white/5 transition-all duration-300"
							>
								<CardHeader className="p-5 pb-3">
									<div className="flex items-start justify-between gap-4">
										<div className="space-y-1.5 min-w-0 flex-1">
											<CardTitle
												className="text-base font-bold truncate text-foreground leading-normal"
												title={t.name || "正在解析元数据..."}
											>
												{t.name || "正在解析元数据..."}
											</CardTitle>
											<p className="text-[10px] font-mono text-muted-foreground truncate">
												Hash: {t.info_hash}
											</p>
										</div>
										<div className="flex items-center gap-1.5 flex-shrink-0">
											{t.finished ? (
												<Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
													已完成
												</Badge>
											) : t.paused ? (
												<Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
													已暂停
												</Badge>
											) : (
												<Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs flex items-center gap-1">
													<Loader2 className="h-3 w-3 animate-spin" />
													下载中
												</Badge>
											)}
										</div>
									</div>
								</CardHeader>

								<CardContent className="px-5 pb-5 pt-0 space-y-4">
									{/* Progress Info */}
									<div className="space-y-2">
										<div className="flex justify-between text-xs font-medium">
											<span className="flex items-center gap-1.5 text-muted-foreground">
												<Download className="h-3.5 w-3.5 text-primary" />
												进度: {progress.toFixed(2)}%
											</span>
											<span className="flex items-center gap-1.5 text-muted-foreground">
												<Activity className="h-3.5 w-3.5 text-emerald-400" />
												网速: {formatBytes(t.download_speed_bytes_per_sec)}/s
												(同伴: {t.peers_connected}/{t.peers_total})
											</span>
										</div>
										<Progress value={progress} className="h-2" />
									</div>

									{/* Storage Info & Actions */}
									<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-1 text-xs">
										<div className="flex gap-4 text-muted-foreground items-center">
											<span className="flex items-center gap-1">
												<HardDrive className="h-3.5 w-3.5" />
												已下载: {formatBytes(t.progress_bytes)}
											</span>
											<span>/</span>
											<span>总大小: {formatBytes(t.total_bytes)}</span>
										</div>

										<div className="flex items-center gap-2 w-full sm:w-auto justify-end">
											{/* Play / View files */}
											<Button
												variant="secondary"
												size="sm"
												onClick={() => handleViewFiles(t)}
												className="h-8 gap-1 text-xs font-medium"
											>
												<FolderOpen className="h-3.5 w-3.5" />
												查看文件
											</Button>

											{/* Pause / Resume */}
											{!t.finished && (
												<Button
													variant="outline"
													size="sm"
													onClick={() => {
														const nameFallback = t.name || "";
														if (t.paused) {
															handleResume(t.info_hash, nameFallback);
														} else {
															handlePause(t.info_hash, nameFallback);
														}
													}}
													className="h-8 w-8 p-0"
													title={t.paused ? "开始下载" : "暂停下载"}
												>
													{t.paused ? (
														<Play className="h-3.5 w-3.5 fill-current" />
													) : (
														<Pause className="h-3.5 w-3.5 fill-current" />
													)}
												</Button>
											)}

											{/* Delete */}
											<Button
												variant="destructive"
												size="sm"
												onClick={() => {
													setDeleteTarget(t);
													setDeleteFiles(false);
												}}
												className="h-8 w-8 p-0"
												title="删除下载"
											>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}

			{/* Delete Confirmation Dialog */}
			<Dialog
				open={deleteTarget !== null}
				onOpenChange={() => setDeleteTarget(null)}
			>
				<DialogContent className="max-w-md bg-card border-white/10 text-card-foreground">
					<DialogHeader>
						<DialogTitle className="text-base font-bold text-foreground">
							删除下载任务
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
							确定要删除种子{" "}
							<span className="font-semibold text-foreground">
								{deleteTarget?.name || deleteTarget?.info_hash.slice(0, 8)}
							</span>{" "}
							的下载任务吗？
						</DialogDescription>
					</DialogHeader>

					{/* File deletion checkbox */}
					<div className="flex items-center space-x-2.5 py-3 border-t border-b border-white/5 my-2">
						<input
							type="checkbox"
							id="delete-files-checkbox"
							checked={deleteFiles}
							onChange={(e) => setDeleteFiles(e.target.checked)}
							className="h-4.5 w-4.5 accent-primary rounded bg-black/20 border-white/10"
						/>
						<label
							htmlFor="delete-files-checkbox"
							className="text-xs font-medium text-foreground cursor-pointer select-none"
						>
							同时删除已下载的本地缓存文件 (彻底释放磁盘空间)
						</label>
					</div>

					<DialogFooter className="gap-2 sm:gap-0 mt-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setDeleteTarget(null)}
							disabled={deleting}
							className="text-xs font-medium"
						>
							取消
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onClick={handleDelete}
							disabled={deleting}
							className="text-xs font-medium gap-1"
						>
							{deleting && <Loader2 className="h-3 w-3 animate-spin" />}
							确认删除
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

import { Activity, ArrowLeft, Download, Info, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAppContext } from "../context/AppContext";
import { useDI } from "../di/DIContext";
import type { TorrentStatusInfo } from "../types";
import { formatBytes } from "../utils";

export default function Player() {
	const navigate = useNavigate();
	const { infoHash, fileId } = useParams<{
		infoHash: string;
		fileId: string;
	}>();
	const [searchParams] = useSearchParams();
	const magnet = searchParams.get("magnet") || "";
	const title = searchParams.get("title") || "";
	const fileName = searchParams.get("fileName") || "正在播放";

	const { torrentRepository } = useDI();
	const { showToast } = useAppContext();
	const [streamUrl, setStreamUrl] = useState<string | null>(null);
	const [torrentStatus, setTorrentStatus] = useState<TorrentStatusInfo | null>(
		null,
	);
	const [loading, setLoading] = useState(true);

	const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Load stream URL and setup status polling
	useEffect(() => {
		if (!infoHash || fileId === undefined) {
			showToast("无效的视频播放参数");
			setLoading(false);
			return;
		}

		let isMounted = true;
		const parsedFileId = parseInt(fileId, 10);

		const initializePlayback = async () => {
			try {
				const url = await torrentRepository.getTorrentStreamUrl(
					infoHash,
					parsedFileId,
				);

				if (!isMounted) return;
				setStreamUrl(url);

				// Get initial status
				const initialStatus =
					await torrentRepository.getTorrentStatus(infoHash);
				if (isMounted) {
					setTorrentStatus(initialStatus);
					setLoading(false);
				}

				// Start polling status
				statusIntervalRef.current = setInterval(async () => {
					try {
						const status = await torrentRepository.getTorrentStatus(infoHash);
						if (isMounted) {
							setTorrentStatus(status);
						}
					} catch (err: unknown) {
						console.error("Failed to fetch torrent status:", err);
					}
				}, 1500);
			} catch (err: unknown) {
				console.error("Failed to start playback:", err);
				if (isMounted) {
					showToast("无法获取视频流，启动播放失败", 10000);
					setLoading(false);
				}
			}
		};

		initializePlayback();

		return () => {
			isMounted = false;
			if (statusIntervalRef.current) {
				clearInterval(statusIntervalRef.current);
			}
		};
	}, [infoHash, fileId, showToast, torrentRepository]);

	const handleCopyStreamUrl = async () => {
		if (!streamUrl) return;
		try {
			await navigator.clipboard.writeText(streamUrl);
			showToast("视频流地址已复制到剪贴板，可在外部播放器中播放");
		} catch {
			showToast("复制失败，请手动复制");
		}
	};

	const handleBackToFileList = () => {
		if (magnet) {
			navigate(
				`/torrent?magnet=${encodeURIComponent(magnet)}&title=${encodeURIComponent(title)}`,
			);
		} else {
			navigate(
				`/torrent?infoHash=${infoHash}&title=${encodeURIComponent(title)}`,
			);
		}
	};

	return (
		<div className="bg-card/30 border border-white/5 rounded-xl p-6 space-y-6">
			{/* Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
				<div className="space-y-1 flex-1 min-w-0">
					<h2
						className="text-lg font-bold truncate pr-4 text-foreground"
						title={fileName}
					>
						{fileName}
					</h2>
					<p className="text-xs text-muted-foreground truncate">
						来自种子: {title || "未命名种子"}
					</p>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={handleBackToFileList}
					className="h-8 gap-1 text-muted-foreground hover:text-foreground self-start md:self-auto"
				>
					<ArrowLeft className="h-4 w-4" />
					返回文件列表
				</Button>
			</div>

			{/* Player Video aspect-ratio */}
			<div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black shadow-inner flex items-center justify-center">
				{loading ? (
					<Loader2 className="h-10 w-10 text-primary animate-spin" />
				) : streamUrl ? (
					/* biome-ignore lint/a11y/useMediaCaption: no captions for local torrent stream */
					<video
						src={streamUrl}
						controls
						autoPlay
						className="h-full w-full object-contain"
					/>
				) : (
					<div className="text-muted-foreground text-sm">无法加载视频流</div>
				)}
			</div>

			{/* Progress & Speed */}
			<div className="space-y-4">
				<div className="space-y-2">
					<div className="flex justify-between text-sm font-medium">
						<span className="flex items-center gap-1.5">
							<Download className="h-4 w-4 text-primary animate-pulse" />
							下载进度:{" "}
							{torrentStatus
								? `${((torrentStatus.progress_bytes / torrentStatus.total_bytes) * 100).toFixed(2)}%`
								: "计算中..."}
						</span>
						<span className="flex items-center gap-1.5 text-muted-foreground">
							<Activity className="h-4 w-4 text-emerald-400" />
							速度:{" "}
							{torrentStatus
								? `${formatBytes(torrentStatus.download_speed_bytes_per_sec)}/s`
								: "0 B/s"}
						</span>
					</div>
					<Progress
						value={
							torrentStatus
								? (torrentStatus.progress_bytes / torrentStatus.total_bytes) *
									100
								: 0
						}
						className="h-2"
					/>
				</div>

				{/* Stats Grid */}
				<div className="grid grid-cols-3 gap-3">
					<div className="flex flex-col items-center justify-center p-3 rounded-lg border border-white/5 bg-black/10">
						<span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
							已下载
						</span>
						<span className="text-sm font-semibold">
							{torrentStatus
								? formatBytes(torrentStatus.progress_bytes)
								: "0 B"}
						</span>
					</div>
					<div className="flex flex-col items-center justify-center p-3 rounded-lg border border-white/5 bg-black/10">
						<span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
							总大小
						</span>
						<span className="text-sm font-semibold">
							{torrentStatus ? formatBytes(torrentStatus.total_bytes) : "0 B"}
						</span>
					</div>
					<div className="flex flex-col items-center justify-center p-3 rounded-lg border border-white/5 bg-black/10">
						<span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
							状态
						</span>
						<span className="text-sm font-semibold text-primary">
							{torrentStatus
								? torrentStatus.finished
									? "已完成"
									: "正在缓存..."
								: "连接中..."}
						</span>
					</div>
				</div>

				{/* Notice */}
				<Alert className="bg-amber-500/5 border-amber-500/20 text-amber-200/90 py-3.5 flex items-start gap-3">
					<Info className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
					<div>
						<AlertTitle className="text-xs font-semibold mb-1">
							播放提示：
						</AlertTitle>
						<AlertDescription className="text-xs leading-relaxed text-amber-200/70">
							Tauri 内置网页浏览器支持直接播放主流 <strong>MP4 (H.264)</strong>{" "}
							格式。 如果视频无法加载（如 MKV、HEVC/H.265
							等格式），您可以复制下方流地址，在 VLC、PotPlayer
							等外部播放器中直接打开播放：
						</AlertDescription>
					</div>
				</Alert>

				{/* Actions */}
				<div className="flex justify-end gap-3 pt-2">
					<Button
						variant="secondary"
						size="sm"
						onClick={handleCopyStreamUrl}
						className="gap-1.5 h-9 font-medium"
					>
						📋 复制视频流地址
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={handleBackToFileList}
						className="gap-1.5 h-9 font-medium"
					>
						⬅ 返回文件列表
					</Button>
				</div>
			</div>
		</div>
	);
}

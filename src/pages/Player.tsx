import { Activity, ArrowLeft, Download, Info, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type {
	SubtitleTrackInfo,
	TorrentStatusInfo,
} from "@/domain/torrent/TorrentSchemas";
import { useAppContext } from "../context/AppContext";
import { useDI } from "../di/DIContext";
import { formatBytes, formatError } from "../utils";

export default function Player() {
	const navigate = useNavigate();
	const { infoHash, fileId } = useParams<{
		infoHash: string;
		fileId: string;
	}>();
	const [searchParams] = useSearchParams();
	const title = searchParams.get("title") || "";
	const fileName = searchParams.get("fileName") || "正在播放";
	const isUnsupportedFormat =
		fileName.toLowerCase().endsWith(".mkv") ||
		fileName.toLowerCase().includes("mkv") ||
		fileName.toLowerCase().includes("hevc") ||
		fileName.toLowerCase().includes("h265") ||
		fileName.toLowerCase().includes("h.265");

	const {
		getTorrentStreamUrlUseCase,
		getTorrentStatusUseCase,
		getSubtitleTracksUseCase,
		getSubtitleVttUseCase,
		subscribeTorrentsUseCase,
		logger,
	} = useDI();
	const playerLogger = useMemo(() => logger.withCategory("Player"), [logger]);
	const { showToast } = useAppContext();
	const [streamUrl, setStreamUrl] = useState<string | null>(null);
	const [torrentStatus, setTorrentStatus] = useState<TorrentStatusInfo | null>(
		null,
	);
	const [loading, setLoading] = useState(true);

	const [subtracks, setSubtracks] = useState<SubtitleTrackInfo[]>([]);
	const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
	const [subtrackSrc, setSubtrackSrc] = useState<string | null>(null);
	const [subloading, setSubloading] = useState<boolean>(false);
	const videoRef = useRef<HTMLVideoElement | null>(null);

	// Clean up subtitle object URL on unmount
	useEffect(() => {
		return () => {
			if (subtrackSrc) {
				URL.revokeObjectURL(subtrackSrc);
			}
		};
	}, [subtrackSrc]);

	// Force showing the track when loaded
	useEffect(() => {
		if (videoRef.current && subtrackSrc && selectedTrackId !== null) {
			const video = videoRef.current;
			const expectedId = selectedTrackId.toString();

			const updateTrackModes = () => {
				for (let i = 0; i < video.textTracks.length; i++) {
					const track = video.textTracks[i];
					if (track.id === expectedId) {
						track.mode = "showing";
					} else {
						track.mode = "disabled";
					}
				}
			};

			// Show immediately if already parsed
			updateTrackModes();

			// Listen for new tracks being added
			const handleAddTrack = () => {
				updateTrackModes();
			};

			video.textTracks.addEventListener("addtrack", handleAddTrack);

			// Timeout fallback
			const timer = setTimeout(updateTrackModes, 150);

			return () => {
				clearTimeout(timer);
				video.textTracks.removeEventListener("addtrack", handleAddTrack);
			};
		}
	}, [subtrackSrc, selectedTrackId]);

	const loadSubtitleVtt = useCallback(
		async (trackId: number) => {
			/* v8 ignore next */
			if (!infoHash || fileId === undefined) return;
			setSubloading(true);
			try {
				const parsedFileId = parseInt(fileId, 10);
				const vttContent = await getSubtitleVttUseCase.execute(
					infoHash,
					parsedFileId,
					trackId,
				);
				const blob = new Blob([vttContent], { type: "text/vtt" });
				const url = URL.createObjectURL(blob);
				setSubtrackSrc((prev) => {
					if (prev) {
						URL.revokeObjectURL(prev);
					}
					return url;
				});
				setSelectedTrackId(trackId);
			} catch (err: unknown) {
				showToast(`加载字幕失败: ${formatError(err)}`);
			} finally {
				setSubloading(false);
			}
		},
		[infoHash, fileId, getSubtitleVttUseCase, showToast],
	);

	useEffect(() => {
		if (!infoHash || fileId === undefined) {
			showToast("无效的视频播放参数");
			setLoading(false);
			return;
		}

		let active = true;
		let loadedTracks = false;
		const parsedFileId = parseInt(fileId, 10);
		let unsubscribe: (() => void) | null = null;

		const initializePlayback = async () => {
			try {
				const url = await getTorrentStreamUrlUseCase.execute(
					infoHash,
					parsedFileId,
				);

				if (!active) return;
				setStreamUrl(url);

				// Get initial status
				const initialStatus = await getTorrentStatusUseCase.execute(infoHash);
				if (!active) return;
				setTorrentStatus(initialStatus);
				setLoading(false);

				// Fetch subtitle tracks
				try {
					const tracks = await getSubtitleTracksUseCase.execute(
						infoHash,
						parsedFileId,
					);
					if (!active) return;
					setSubtracks(tracks || []);
					loadedTracks = true;
					if (tracks && tracks.length > 0) {
						loadSubtitleVtt(tracks[0].id);
					}
				} catch (err: unknown) {
					if (!active) return;
					playerLogger.warn("Failed to fetch subtitle tracks initially:", err);
				}

				// Start subscription to status stream
				let isFirstEvent = true;
				const unsub = await subscribeTorrentsUseCase.execute(async (list) => {
					if (!active) return;
					const status = list.find((t) => t && t.info_hash === infoHash);
					if (status) {
						setTorrentStatus(status);

						if (isFirstEvent) {
							isFirstEvent = false;
							return;
						}

						// If subtitle tracks haven't been loaded yet, try to load them as download progresses
						if (!loadedTracks) {
							try {
								const tracks = await getSubtitleTracksUseCase.execute(
									infoHash,
									parsedFileId,
								);
								if (!active) return;
								setSubtracks(tracks || []);
								loadedTracks = true;
								if (tracks && tracks.length > 0) {
									loadSubtitleVtt(tracks[0].id);
								}
							} catch (err: unknown) {
								if (!active) return;
								playerLogger.warn(
									"Failed to fetch subtitle tracks during subscription update:",
									err,
								);
							}
						}
					}
				});

				if (!active) {
					unsub();
				} else {
					unsubscribe = unsub;
				}
			} catch (err: unknown) {
				if (active) {
					showToast(`无法获取视频流: ${formatError(err)}`, 10000);
					setLoading(false);
				}
			}
		};

		initializePlayback();

		return () => {
			active = false;
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [
		infoHash,
		fileId,
		showToast,
		getTorrentStreamUrlUseCase,
		getTorrentStatusUseCase,
		getSubtitleTracksUseCase,
		subscribeTorrentsUseCase,
		loadSubtitleVtt,
		playerLogger,
	]);

	const handleCopyStreamUrl = async () => {
		if (!streamUrl) return;
		try {
			await navigator.clipboard.writeText(streamUrl);
			showToast("视频流地址已复制到剪贴板，可在外部播放器中播放");
		} catch {
			showToast("复制失败，请手动复制");
		}
	};

	const handleBack = () => {
		navigate(-1);
	};

	return (
		<div className="bg-card/30 border border-white/5 rounded-xl p-6 space-y-6">
			{/* Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
				<div className="space-y-1 flex-1 min-w-0">
					<h2
						className="text-lg font-bold pr-4 text-foreground"
						title={fileName}
					>
						{fileName}
					</h2>
					<p className="text-xs text-muted-foreground">
						来自种子: {title || "未命名种子"}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
					<Button
						variant="ghost"
						size="sm"
						onClick={handleCopyStreamUrl}
						className="h-8 gap-1 text-muted-foreground hover:text-foreground"
					>
						📋 复制视频流地址
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleBack}
						className="h-8 gap-1 text-muted-foreground hover:text-foreground"
					>
						<ArrowLeft className="h-4 w-4" />
						返回
					</Button>
				</div>
			</div>

			{isUnsupportedFormat && (
				<Alert className="bg-amber-500/5 border-amber-500/20 text-amber-200/90 py-3.5 flex items-start gap-3">
					<Info className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
					<div className="flex-1 min-w-0">
						<AlertTitle className="text-sm font-semibold mb-1">
							当前视频格式在内置播放器中可能无法播放
						</AlertTitle>
						<AlertDescription className="text-xs leading-relaxed text-amber-200/70">
							当前播放的文件格式为 <strong>MKV / HEVC(H.265)</strong>。出于
							WebView
							内核安全和硬解码限制，内置播放器经常会出现黑屏、转圈或仅有声音。如果您无法播放，建议点击右侧按钮复制地址，使用外部播放器播放：
						</AlertDescription>
					</div>
				</Alert>
			)}

			{/* Player Video aspect-ratio */}
			<div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black shadow-inner flex items-center justify-center">
				{loading ? (
					<Loader2 className="h-10 w-10 text-primary animate-spin" />
				) : streamUrl ? (
					/* biome-ignore lint/a11y/useMediaCaption: no captions for local torrent stream */
					<video
						ref={videoRef}
						src={streamUrl}
						controls
						autoPlay
						className="h-full w-full object-contain"
					>
						{subtrackSrc && selectedTrackId !== null && (
							<track
								id={selectedTrackId.toString()}
								key={subtrackSrc}
								kind="subtitles"
								src={subtrackSrc}
								srcLang={
									subtracks.find((t) => t.id === selectedTrackId)?.language ||
									"zh"
								}
								label={
									subtracks.find((t) => t.id === selectedTrackId)?.title ||
									"默认字幕"
								}
								default
							/>
						)}
					</video>
				) : (
					<div className="text-muted-foreground text-sm">无法加载视频流</div>
				)}
			</div>

			{/* Subtitle Tracks Selection */}
			{!loading && streamUrl && subtracks.length > 0 && (
				<div className="flex items-center gap-2.5 p-3 bg-black/20 border border-white/5 rounded-lg">
					<span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
						字幕轨道:
					</span>
					<div className="flex items-center gap-2">
						<Select
							value={
								selectedTrackId === null ? "none" : selectedTrackId.toString()
							}
							onValueChange={(val) => {
								if (val === "none") {
									setSelectedTrackId(null);
									setSubtrackSrc((prev) => {
										// v8 ignore next 3
										if (prev) {
											URL.revokeObjectURL(prev);
										}
										return null;
									});
								} else {
									loadSubtitleVtt(parseInt(val, 10));
								}
							}}
							disabled={subloading}
						>
							<SelectTrigger className="w-[200px] h-8 text-xs dark:bg-zinc-950/60 border-white/10">
								<SelectValue placeholder="选择字幕轨道" />
							</SelectTrigger>
							<SelectContent
								position="popper"
								className="z-50 dark bg-zinc-950 border-white/10 text-white"
							>
								<SelectItem
									value="none"
									className="hover:bg-white/10 cursor-pointer"
								>
									无
								</SelectItem>
								{subtracks.map((track) => (
									<SelectItem
										key={track.id}
										value={track.id.toString()}
										className="hover:bg-white/10 cursor-pointer"
									>
										{track.title
											? `${track.title} [${track.language.toUpperCase()}]`
											: `轨道 ${track.id} [${track.language.toUpperCase()}]`}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{subloading && (
							<Loader2 className="h-4 w-4 text-primary animate-spin" />
						)}
					</div>
				</div>
			)}

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
								? `${formatBytes(torrentStatus.download_speed_bytes_per_sec)}/s (连接: ${torrentStatus.peers_connected}/${torrentStatus.peers_total})`
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
				<div className="grid grid-cols-4 gap-2.5">
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
							同伴 (连接/发现)
						</span>
						<span className="text-sm font-semibold">
							{torrentStatus
								? `${torrentStatus.peers_connected} / ${torrentStatus.peers_total}`
								: "0 / 0"}
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
			</div>
		</div>
	);
}

import {
	Activity,
	ArrowLeft,
	Clipboard,
	Download,
	Loader2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import type {
	SubtitleTrackInfo,
	TorrentStatusInfo,
} from "@/domain/torrent/TorrentSchemas";
import { Button } from "@/presentation/components/ui/button";
import { Progress } from "@/presentation/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/presentation/components/ui/select";
import { formatBytes, formatError } from "@/utils";
import { useAppContext } from "../context/AppContext";

export default function Player() {
	const navigate = useNavigate();

	const { infoHash, fileId } = useParams<{
		infoHash: string;
		fileId: string;
	}>();
	const [searchParams] = useSearchParams();
	const title = searchParams.get("title") || "";
	const fileName = searchParams.get("fileName") || "正在播放";

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
	const [subtrackSrcs, setSubtrackSrcs] = useState<Record<number, string>>({});
	const [subloading, setSubloading] = useState<boolean>(false);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const subtrackSrcsRef = useRef<Record<number, string>>({});

	// Clean up subtitle object URLs on unmount
	useEffect(() => {
		return () => {
			for (const src of Object.values(subtrackSrcsRef.current)) {
				if (src) {
					URL.revokeObjectURL(src);
				}
			}
		};
	}, []);

	const loadSubtitleVtt = useCallback(
		async (trackId: number) => {
			/* v8 ignore next */
			if (!infoHash || fileId === undefined) return;
			setSubloading(true);
			try {
				const parsedFileId = parseInt(fileId, 10);
				const vttContent = await getSubtitleVttUseCase.execute({
					infoHash,
					fileId: parsedFileId,
					trackId,
				});
				const blob = new Blob([vttContent], { type: "text/vtt" });
				const url = URL.createObjectURL(blob);
				setSubtrackSrcs((prev) => {
					const next = { ...prev, [trackId]: url };
					subtrackSrcsRef.current = next;
					return next;
				});
				setSelectedTrackId(trackId);
			} catch (err: unknown) {
				showToast(`加载字幕失败: ${formatError(err)}`, "error");
			} finally {
				setSubloading(false);
			}
		},
		[infoHash, fileId, getSubtitleVttUseCase, showToast],
	);

	// Synchronize subtitle track selection between Video.js and external state
	useEffect(() => {
		if (videoRef.current) {
			const video = videoRef.current;

			const updateTrackModes = () => {
				const expectedId =
					selectedTrackId !== null ? selectedTrackId.toString() : "none";
				for (let i = 0; i < video.textTracks.length; i++) {
					const track = video.textTracks[i];
					if (track.id === expectedId) {
						track.mode = "showing";
					} else {
						track.mode = "disabled";
					}
				}
			};

			updateTrackModes();

			/* v8 ignore start */
			const handleTrackChange = () => {
				let activeId: number | null = null;
				for (let i = 0; i < video.textTracks.length; i++) {
					const track = video.textTracks[i];
					if (track.mode === "showing") {
						const parsedId = parseInt(track.id, 10);
						if (!Number.isNaN(parsedId)) {
							activeId = parsedId;
						}
					}
				}

				if (activeId !== selectedTrackId) {
					if (activeId === null) {
						setSelectedTrackId(null);
					} else {
						if (!subtrackSrcs[activeId]) {
							loadSubtitleVtt(activeId);
						} else {
							setSelectedTrackId(activeId);
						}
					}
				}
			};
			/* v8 ignore stop */

			video.textTracks.addEventListener("change", handleTrackChange);
			video.textTracks.addEventListener("addtrack", updateTrackModes);

			return () => {
				video.textTracks.removeEventListener("change", handleTrackChange);
				video.textTracks.removeEventListener("addtrack", updateTrackModes);
			};
		}
	}, [selectedTrackId, subtrackSrcs, loadSubtitleVtt]);

	useEffect(() => {
		if (!infoHash || fileId === undefined) {
			showToast("无效的视频播放参数", "error");
			setLoading(false);
			return;
		}

		let active = true;
		let loadedTracks = false;
		const parsedFileId = parseInt(fileId, 10);
		let unsubscribe: (() => void) | null = null;

		const fetchSubtitles = async (isInitial = false) => {
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
					isInitial
						? "Failed to fetch subtitle tracks initially:"
						: "Failed to fetch subtitle tracks during subscription update:",
					err,
				);
			}
		};

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
				await fetchSubtitles(true);

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
							await fetchSubtitles(false);
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
					showToast(`无法获取视频流: ${formatError(err)}`, "error", 10000);
					setLoading(false);
				}
			}
		};

		initializePlayback();

		return () => {
			active = false;
			unsubscribe?.();
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
			showToast("视频流地址已复制到剪贴板，可在外部播放器中播放", "success");
		} catch {
			showToast("复制失败，请手动复制", "error");
		}
	};

	const handleBack = () => {
		navigate(-1);
	};

	return (
		<div className="w-full space-y-4 animate-in fade-in duration-300">
			{/* Navigation Header */}
			<button
				type="button"
				onClick={handleBack}
				className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
			>
				<ArrowLeft className="h-4 w-4" />
				返回
			</button>

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
							<Clipboard className="h-4 w-4" />
							复制视频流地址
						</Button>
					</div>
				</div>

				{/* Player Video aspect-ratio */}
				<div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black shadow-inner flex items-center justify-center">
					{loading ||
					!streamUrl ||
					!torrentStatus ||
					(torrentStatus.progress_bytes / torrentStatus.total_bytes) * 100 <
						1 ? (
						<Loader2 className="h-10 w-10 text-primary animate-spin" />
					) : (
						/* biome-ignore lint/a11y/useMediaCaption: subtitles are loaded dynamically from torrent file */
						<video
							ref={videoRef}
							src={streamUrl}
							controls
							playsInline
							webkit-playsinline="true"
							className="h-full w-full object-contain"
							onError={(e) => {
								const video = e.currentTarget;
								const mediaError = video.error;
								playerLogger.error("Video element error:", mediaError);

								let errorMsg = "视频加载失败";
								if (mediaError) {
									if (mediaError.code === 4) {
										errorMsg =
											"当前浏览器不支持播放该格式（例如 MKV 容器），建议点击上方按钮“用系统播放器播放”。";
									} else if (mediaError.code === 3) {
										errorMsg = "视频解码失败，可能数据已损坏或编码不支持。";
									} else if (mediaError.code === 2) {
										errorMsg = "视频加载超时或网络断开。";
									}
								}
								showToast(errorMsg, "error", 8000);
							}}
						>
							{subtracks.map((track) => (
								<track
									id={track.id.toString()}
									key={track.id}
									kind="subtitles"
									src={subtrackSrcs[track.id] || undefined}
									srcLang={track.language}
									label={track.title || `轨道 ${track.id}`}
									default={track.id === selectedTrackId}
								/>
							))}
						</video>
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
									} else {
										const id = parseInt(val, 10);
										if (!subtrackSrcs[id]) {
											loadSubtitleVtt(id);
										} else {
											/* v8 ignore next 2 */
											setSelectedTrackId(id);
										}
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
						<div className="flex flex-col sm:flex-row sm:justify-between gap-2 text-xs sm:text-sm font-medium">
							<span className="flex items-center gap-1.5">
								<Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary animate-pulse" />
								下载进度:{" "}
								{torrentStatus
									? `${((torrentStatus.progress_bytes / torrentStatus.total_bytes) * 100).toFixed(2)}%`
									: "计算中..."}
							</span>
							<span className="flex items-center gap-1.5 text-muted-foreground">
								<Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" />
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
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
						<div className="flex flex-col items-center justify-center p-3 rounded-lg border border-white/5 bg-black/10">
							<span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-center">
								已下载
							</span>
							<span className="text-sm font-semibold whitespace-nowrap">
								{torrentStatus
									? formatBytes(torrentStatus.progress_bytes)
									: "0 B"}
							</span>
						</div>
						<div className="flex flex-col items-center justify-center p-3 rounded-lg border border-white/5 bg-black/10">
							<span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-center">
								总大小
							</span>
							<span className="text-sm font-semibold whitespace-nowrap">
								{torrentStatus ? formatBytes(torrentStatus.total_bytes) : "0 B"}
							</span>
						</div>
						<div className="flex flex-col items-center justify-center p-3 rounded-lg border border-white/5 bg-black/10">
							<span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-center">
								同伴 (连接/总数)
							</span>
							<span className="text-sm font-semibold whitespace-nowrap">
								{torrentStatus
									? `${torrentStatus.peers_connected} / ${torrentStatus.peers_total}`
									: "0 / 0"}
							</span>
						</div>
						<div className="flex flex-col items-center justify-center p-3 rounded-lg border border-white/5 bg-black/10">
							<span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-center">
								状态
							</span>
							<span className="text-sm font-semibold text-primary whitespace-nowrap">
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
		</div>
	);
}

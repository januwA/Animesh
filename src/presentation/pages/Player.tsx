import {
	Activity,
	ArrowLeft,
	Clipboard,
	Download,
	Loader2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import type { SubtitleTrackInfo } from "@/domain/torrent/TorrentSchemas";
import { InvalidParamsView } from "@/presentation/components/InvalidParamsView";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { Progress } from "@/presentation/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/presentation/components/ui/select";
import { formatBytes, formatError } from "@/utils";
import "@videojs/react/video/skin.css";
import { createPlayer, selectError, videoFeatures } from "@videojs/react";
import { Video, VideoSkin } from "@videojs/react/video";
import { useTorrentStatus } from "@/presentation/context/TorrentStatusContext";
import { useMutation } from "@/presentation/hooks/useMutation";
import { useQuery } from "@/presentation/hooks/useQuery";

const JsPlayer = createPlayer({ features: videoFeatures });

interface SubtitleVttDto {
	infoHash: string;
	fileId: number;
	trackId: number;
}

function JsPlayerErrorMonitor() {
	const errorState = JsPlayer.usePlayer(selectError);
	const { logger } = useDI();
	const monitorLogger = useMemo(() => logger.withCategory("Player"), [logger]);
	const lastErrorRef = useRef<object | null>(null);

	useEffect(() => {
		const error = errorState?.error ?? null;
		if (error) {
			// v8 ignore next
			if (lastErrorRef.current === error) return;
			lastErrorRef.current = error;
			monitorLogger.error("Video element error:", error);

			let errorMsg = "视频加载失败";
			if (error.code === 4) {
				errorMsg =
					"当前浏览器不支持播放该格式（例如 MKV 容器），建议点击上方按钮“用系统播放器播放”。";
			} else if (error.code === 3) {
				errorMsg = "视频解码失败，可能数据已损坏或编码不支持。";
			} else if (error.code === 2) {
				errorMsg = "视频加载超时或网络断开。";
			}
			toast.error(errorMsg, { duration: 8000 });
			errorState?.dismissError?.();
		} else {
			lastErrorRef.current = null;
		}
	}, [errorState?.error, monitorLogger, errorState?.dismissError]);

	return null;
}

const playerParamsSchema = z.object({
	infoHash: z.string().trim().min(1, "缺少种子哈希参数"),
	fileId: z.preprocess(
		(value) =>
			typeof value === "string" && value !== "" ? Number(value) : value,
		z.number({ message: "文件 ID 必须是数字" }).int("文件 ID 必须是整数"),
	),
	title: z.string().default(""),
	fileName: z.string().default("正在播放"),
});

type PlayerParams = z.infer<typeof playerParamsSchema>;

export default function Player() {
	const { infoHash, fileId } = useParams<{
		infoHash: string;
		fileId: string;
	}>();
	const [searchParams] = useSearchParams();

	const parsed = playerParamsSchema.safeParse({
		infoHash,
		fileId,
		title: searchParams.get("title") ?? undefined,
		fileName: searchParams.get("fileName") ?? undefined,
	});
	if (!parsed.success) {
		return (
			<InvalidParamsView title="无效的视频播放参数" error={parsed.error} />
		);
	}

	return <PlayerCore {...parsed.data} />;
}

function PlayerCore({ infoHash, fileId, title, fileName }: PlayerParams) {
	const navigate = useNavigate();

	const {
		getTorrentStreamUrlUseCase,
		getSubtitleTracksUseCase,
		getSubtitleVttUseCase,
	} = useDI();
	const { torrents } = useTorrentStatus();
	const torrentStatus = torrents.find((t) => t?.info_hash === infoHash) ?? null;

	// Stream URL (one-shot query keyed by infoHash + fileId)
	const stream = useQuery<string>(
		(_ctx) => getTorrentStreamUrlUseCase.execute(infoHash, fileId),
		[infoHash, fileId, getTorrentStreamUrlUseCase],
		{
			onError: (error) =>
				toast.error(`无法获取视频流: ${formatError(error)}`, {
					duration: 10000,
				}),
		},
	);

	// Subtitle tracks (refetchable as the download progresses)
	const subtitles = useQuery<SubtitleTrackInfo[]>(
		(_ctx) => getSubtitleTracksUseCase.execute(infoHash, fileId),
		[infoHash, fileId, getSubtitleTracksUseCase],
	);
	const subtracks = subtitles.data ?? [];
	const subtitlesReady = subtitles.data !== null;

	// Subtitle VTT sources (lazy per-track load + object URL cleanup)
	const [subtrackSrcs, setSubtrackSrcs] = useState<Record<number, string>>({});
	const subtrackSrcsRef = useRef<Record<number, string>>({});
	const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);

	const subtitleMutation = useMutation<string, SubtitleVttDto>(
		(_ctx, dto) => getSubtitleVttUseCase.execute(dto),
		{
			onSuccess: (vtt, dto) => {
				const url = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
				const next = { ...subtrackSrcsRef.current, [dto.trackId]: url };
				subtrackSrcsRef.current = next;
				setSubtrackSrcs(next);
			},
			onError: (error) => toast.error(`加载字幕失败: ${formatError(error)}`),
		},
	);

	const loadSubtitleVtt = useCallback(
		(trackId: number) => {
			if (subtrackSrcsRef.current[trackId]) return;
			subtitleMutation.execute({
				infoHash,
				fileId,
				trackId,
			});
		},
		[infoHash, fileId, subtitleMutation],
	);

	// Clean up subtitle object URLs on unmount
	useEffect(() => {
		return () => {
			for (const url of Object.values(subtrackSrcsRef.current)) {
				if (url) URL.revokeObjectURL(url);
			}
			subtrackSrcsRef.current = {};
		};
	}, []);

	// Auto-select and load the first subtitle track once available
	useEffect(() => {
		if (!subtracks.length || selectedTrackId !== null) return;
		const first = subtracks[0];
		setSelectedTrackId(first.id);
		loadSubtitleVtt(first.id);
	}, [subtracks, selectedTrackId, loadSubtitleVtt]);

	const handleSubtitleChange = useCallback(
		(trackId: string) => {
			const id = trackId ? parseInt(trackId, 10) : null;
			setSelectedTrackId(id);
			if (id !== null) loadSubtitleVtt(id);
		},
		[loadSubtitleVtt],
	);

	useEffect(() => {
		if (subtitlesReady || !torrentStatus) return;
		subtitles.refetch();
	}, [torrentStatus, subtitlesReady, subtitles.refetch]);

	const handleCopyStreamUrl = async () => {
		if (!streamUrl) return;
		try {
			await navigator.clipboard.writeText(streamUrl);
			toast.success("视频流地址已复制到剪贴板，可在外部播放器中播放");
		} catch {
			toast.error("复制失败，请手动复制");
		}
	};

	const handleBack = () => {
		navigate(-1);
	};

	const streamUrl = stream.data;
	const canPlay =
		!!streamUrl &&
		!!torrentStatus &&
		(torrentStatus.progress_bytes / torrentStatus.total_bytes) * 100 >= 1;

	const videoElement = canPlay ? (
		<JsPlayer.Provider>
			<VideoSkin className="w-full h-full">
				<Video src={streamUrl} playsInline>
					{subtracks
						.filter((t) => t.id === selectedTrackId)
						.map((track) => (
							<track
								key={track.id}
								id={track.id.toString()}
								kind="subtitles"
								src={subtrackSrcs[track.id] || undefined}
								srcLang={track.language}
								label={track.title}
								default
							/>
						))}
				</Video>
			</VideoSkin>
			<JsPlayerErrorMonitor />
		</JsPlayer.Provider>
	) : (
		<div className="flex items-center justify-center h-full">
			<Loader2 className="h-10 w-10 text-primary animate-spin" />
		</div>
	);

	return (
		<div className="w-full flex flex-col gap-4 lg:gap-6 animate-in fade-in duration-300">
			{/* Navigation Header */}
			<Button
				variant="ghost"
				size="sm"
				onClick={handleBack}
				className="gap-2 text-muted-foreground hover:text-foreground w-fit"
			>
				<ArrowLeft className="h-4 w-4" />
				返回
			</Button>

			{/* Player Video */}
			<div className="relative w-full aspect-video max-h-dvh overflow-hidden rounded-xl">
				{videoElement}
			</div>

			{/* Title & Actions */}
			<div className="flex flex-col gap-3">
				<div className="flex flex-col gap-1">
					<h1
						className="text-xl sm:text-2xl font-bold text-foreground break-words"
						title={fileName}
					>
						{fileName}
					</h1>
					<p className="text-sm text-muted-foreground">
						来自种子: {title || "未命名种子"}
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{subtracks.length > 0 && (
						<>
							<span className="text-xs text-muted-foreground shrink-0">
								字幕:
							</span>
							<Select
								value={selectedTrackId?.toString() ?? ""}
								onValueChange={handleSubtitleChange}
							>
								<SelectTrigger className="w-40 h-8 text-xs">
									<SelectValue placeholder="选择字幕" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="">关闭</SelectItem>
									{subtracks.map((track) => (
										<SelectItem key={track.id} value={track.id.toString()}>
											{track.title || `轨道 ${track.id}`} ({track.language})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{subtitleMutation.loading && (
								<Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
							)}
						</>
					)}

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

			{/* Progress & Stats */}
			<div className="rounded-xl border border-border bg-muted/50 p-4 flex flex-col gap-4">
				<div className="flex flex-col gap-2">
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
					<Card className="bg-muted/50 border-border">
						<CardContent className="flex flex-col items-center justify-center p-3">
							<span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-center">
								已下载
							</span>
							<span className="text-sm font-semibold whitespace-nowrap">
								{torrentStatus
									? formatBytes(torrentStatus.progress_bytes)
									: "0 B"}
							</span>
						</CardContent>
					</Card>
					<Card className="bg-muted/50 border-border">
						<CardContent className="flex flex-col items-center justify-center p-3">
							<span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-center">
								总大小
							</span>
							<span className="text-sm font-semibold whitespace-nowrap">
								{torrentStatus ? formatBytes(torrentStatus.total_bytes) : "0 B"}
							</span>
						</CardContent>
					</Card>
					<Card className="bg-muted/50 border-border">
						<CardContent className="flex flex-col items-center justify-center p-3">
							<span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 text-center">
								同伴 (连接/总数)
							</span>
							<span className="text-sm font-semibold whitespace-nowrap">
								{torrentStatus
									? `${torrentStatus.peers_connected} / ${torrentStatus.peers_total}`
									: "0 / 0"}
							</span>
						</CardContent>
					</Card>
					<Card className="bg-muted/50 border-border">
						<CardContent className="flex flex-col items-center justify-center p-3">
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
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

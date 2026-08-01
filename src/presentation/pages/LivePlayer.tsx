import { ArrowLeft, Clipboard, Link2, Loader2, Radio } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import "@videojs/react/video/skin.css";
import { createPlayer, liveVideoFeatures, selectError } from "@videojs/react";
import {
	HlsJsVideo,
	type HlsJsVideoProps,
} from "@videojs/react/media/hlsjs-video";
import { VideoSkin } from "@videojs/react/video";
import { LazyImage } from "../components/LazyImage";

const JsLivePlayer = createPlayer({ features: liveVideoFeatures });

type HlsMediaConfig = NonNullable<HlsJsVideoProps["config"]>;

const MAX_RECOVERIES = 5;

function JsLivePlayerErrorMonitor({ onRecover }: { onRecover: () => void }) {
	const errorState = JsLivePlayer.usePlayer(selectError);
	const { logger } = useDI();
	const monitorLogger = useMemo(
		() => logger.withCategory("LivePlayer"),
		[logger],
	);
	const lastErrorRef = useRef<object | null>(null);

	useEffect(() => {
		const error = errorState?.error ?? null;
		if (error) {
			// v8 ignore next
			if (lastErrorRef.current === error) return;
			lastErrorRef.current = error;
			monitorLogger.error("Live video element error:", error);

			let errorMsg = "直播流加载失败";
			if (error.code === 4) {
				errorMsg = "当前浏览器不支持播放该直播源。";
			} else if (error.code === 3) {
				errorMsg = "直播流解码失败，可能源地址已失效或编码不支持。";
			} else if (error.code === 2) {
				errorMsg = "直播流加载超时或网络断开。";
			}
			toast.error(errorMsg, { duration: 8000 });

			if (error.code === 2 || error.code === 3) {
				onRecover();
			}
			errorState?.dismissError?.();
		} else {
			lastErrorRef.current = null;
		}
	}, [errorState?.error, monitorLogger, errorState?.dismissError, onRecover]);

	return null;
}

export default function LivePlayer() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const url = searchParams.get("url") || "";
	const name = searchParams.get("name") || "";
	const logo = searchParams.get("logo") || "";
	const category = searchParams.get("category") || "";

	const { resolvePlayableStreamUrlUseCase } = useDI();
	const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
	const [reloadKey, setReloadKey] = useState(0);
	const recoveriesRef = useRef(0);

	const hlsMediaConfig = useMemo<HlsMediaConfig>(
		() => ({
			hlsJs: {
				enableWorker: true,
				fragLoadingTimeOut: 20000,
				fragLoadingMaxRetry: 20,
				fragLoadingRetryDelay: 200,
				fragLoadingMaxRetryTimeout: 60000,
				levelLoadingTimeOut: 20000,
				levelLoadingMaxRetry: 10,
				levelLoadingRetryDelay: 300,
				manifestLoadingTimeOut: 20000,
				manifestLoadingMaxRetry: 10,
				manifestLoadingRetryDelay: 300,
				liveSyncDurationCount: 3,
				liveMaxLatencyDurationCount: 6,
				maxBufferLength: 30,
				backBufferLength: 30,
			},
		}),
		[],
	);

	const handleRecover = useCallback(() => {
		if (recoveriesRef.current >= MAX_RECOVERIES) return;
		recoveriesRef.current += 1;
		toast("直播流中断，正在自动重连...");
		setReloadKey((key) => key + 1);
	}, []);

	useEffect(() => {
		let cancelled = false;
		if (!url) {
			setResolvedUrl(null);
			return;
		}
		resolvePlayableStreamUrlUseCase
			.execute(url)
			.then((playableUrl) => {
				if (!cancelled) setResolvedUrl(playableUrl);
			})
			.catch(() => {
				if (!cancelled) setResolvedUrl(url);
			});
		return () => {
			cancelled = true;
		};
	}, [url, resolvePlayableStreamUrlUseCase]);

	const handleBack = () => {
		navigate(-1);
	};

	const handleCopyRawUrl = async () => {
		try {
			await navigator.clipboard.writeText(url);
			toast.success("直播源地址已复制，可添加到代理规则中");
		} catch {
			toast.error("复制失败，请手动复制");
		}
	};

	return (
		<div className="w-full flex flex-col gap-4 lg:gap-6 animate-in fade-in duration-300">
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
				{url ? (
					resolvedUrl ? (
						<JsLivePlayer.Provider>
							<VideoSkin className="w-full h-full">
								<HlsJsVideo
									key={reloadKey}
									src={resolvedUrl}
									streamType="live"
									config={hlsMediaConfig}
									playsInline
								/>
							</VideoSkin>
							<JsLivePlayerErrorMonitor onRecover={handleRecover} />
						</JsLivePlayer.Provider>
					) : (
						<div className="flex items-center justify-center gap-3 h-full text-muted-foreground">
							<Loader2 className="h-6 w-6 animate-spin" />
							<p className="text-sm">正在加载直播源...</p>
						</div>
					)
				) : (
					<div className="flex flex-col items-center justify-center gap-3 h-full text-muted-foreground">
						<Radio className="h-10 w-10 text-primary/40" />
						<p className="text-sm">无效的直播地址</p>
					</div>
				)}
			</div>

			{/* Channel Info */}
			{url && (
				<div className="flex flex-col gap-4">
					<div className="flex items-start gap-3">
						{logo && (
							<div className="h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0">
								<LazyImage src={logo} alt={name} />
							</div>
						)}
						<div className="flex flex-col gap-1 min-w-0 flex-1">
							<h1
								className="text-xl sm:text-2xl font-bold text-foreground truncate"
								title={name}
							>
								{name || "未命名频道"}
							</h1>
							<div className="flex items-center gap-2">
								{category && <Badge variant="secondary">{category}</Badge>}
								<span className="text-xs text-muted-foreground">直播</span>
							</div>
						</div>
					</div>

					{/* Raw URL */}
					<div className="rounded-xl border border-border bg-muted/50 p-4 flex flex-col gap-2">
						<div className="flex items-center gap-2">
							<Link2 className="h-4 w-4 text-muted-foreground" />
							<span className="text-xs text-muted-foreground">
								原始直播源地址
							</span>
						</div>
						<div className="flex items-center gap-2">
							<p className="flex-1 min-w-0 font-mono text-xs text-muted-foreground break-all">
								{url}
							</p>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleCopyRawUrl}
								className="h-8 gap-1 shrink-0 text-muted-foreground hover:text-foreground"
							>
								<Clipboard className="h-4 w-4" />
								复制
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

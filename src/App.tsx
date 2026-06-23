import { invoke } from "@tauri-apps/api/core";
import { type FormEvent, useEffect, useRef, useState } from "react";
import "./App.css";

import {
	Activity,
	Clock,
	Download,
	FileVideo,
	Film,
	Globe,
	HardDrive,
	Info,
	Loader2,
	Play,
	Search,
	X,
} from "lucide-react";
import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

// ==========================================
// 类型定义 (Types & Interfaces)
// ==========================================
interface SearchResultItem {
	title: string;
	link: string;
	pub_date: string;
	magnet: string;
	size: number | null;
}

interface ToastMessage {
	id: number;
	text: string;
}

interface FileDetails {
	id: number;
	name: string;
	len: number;
}

interface AddTorrentResult {
	info_hash: string;
	name: string | null;
	files: FileDetails[];
}

interface TorrentStatusInfo {
	info_hash: string;
	name: string | null;
	progress_bytes: number;
	total_bytes: number;
	finished: boolean;
	download_speed_bytes_per_sec: number;
}

// ==========================================
// 工具函数 (Helper Functions)
// ==========================================
function formatBytes(bytes: number | null | undefined): string {
	if (bytes === null || bytes === undefined || bytes === 0) return "未知大小";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

// ==========================================
// 解耦的子组件 (Sub-components)
// ==========================================

// 页面头部组件
function AppHeader() {
	return (
		<header className="text-center mb-10 space-y-3">
			<h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent drop-shadow-md select-none">
				Animesh
			</h1>
			<p className="text-muted-foreground text-sm font-light tracking-wide">
				BT 边下边播 & 磁力聚合搜索客户端
			</p>
		</header>
	);
}

// 搜索栏组件
interface SearchFormProps {
	keyword: string;
	setKeyword: (val: string) => void;
	loading: boolean;
	onSubmit: (e: FormEvent) => void;
}
function SearchForm({
	keyword,
	setKeyword,
	loading,
	onSubmit,
}: SearchFormProps) {
	return (
		<section className="max-w-2xl mx-auto w-full mb-8">
			<form
				onSubmit={onSubmit}
				className="relative flex items-center bg-card/40 backdrop-blur-md rounded-xl border border-white/10 shadow-lg p-1 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300"
			>
				<Search className="absolute left-4 h-5 w-5 text-muted-foreground" />
				<Input
					id="search-input"
					className="pl-12 pr-28 py-6 bg-transparent border-0 ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
					value={keyword}
					onChange={(e) => setKeyword(e.target.value)}
					placeholder="输入动漫名称，例如：凡人修仙传..."
					disabled={loading}
				/>
				<Button
					type="submit"
					className="absolute right-2 px-6 h-10 font-medium"
					disabled={loading || !keyword.trim()}
				>
					{loading ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							搜索中...
						</>
					) : (
						"搜索"
					)}
				</Button>
			</form>
		</section>
	);
}

// 搜索加载指示器
function SearchLoading() {
	return (
		<div className="flex flex-col items-center justify-center py-20 space-y-4">
			<Loader2 className="h-10 w-10 text-primary animate-spin" />
			<p className="text-sm text-muted-foreground font-medium">
				正在获取 动漫花园 资源列表...
			</p>
		</div>
	);
}

// 错误横幅
function ErrorBanner({ message }: { message: string }) {
	return (
		<div className="max-w-2xl mx-auto w-full py-4">
			<Alert
				variant="destructive"
				className="bg-destructive/10 border-destructive/20 text-destructive-foreground"
			>
				<AlertTitle className="font-semibold">搜索失败</AlertTitle>
				<AlertDescription className="text-sm">{message}</AlertDescription>
			</Alert>
		</div>
	);
}

// 初始引导推荐组件
function WelcomeGuide() {
	return (
		<div className="max-w-2xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 opacity-75">
			<Card className="bg-card/25 border-white/5">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-semibold flex items-center gap-2">
						<Search className="h-4 w-4 text-cyan-400" />
						聚合搜索
					</CardTitle>
				</CardHeader>
				<CardContent className="text-xs text-muted-foreground leading-relaxed">
					一键检索动漫花园资源列表，快速检索并汇总磁力资源。
				</CardContent>
			</Card>
			<Card className="bg-card/25 border-white/5">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-semibold flex items-center gap-2">
						<Play className="h-4 w-4 text-blue-400" />
						边下边播
					</CardTitle>
				</CardHeader>
				<CardContent className="text-xs text-muted-foreground leading-relaxed">
					内置高性能 BT 流媒体播放引擎，无须等待下载完毕，边下边放。
				</CardContent>
			</Card>
			<Card className="bg-card/25 border-white/5">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-semibold flex items-center gap-2">
						<Globe className="h-4 w-4 text-indigo-400" />
						外部播放
					</CardTitle>
				</CardHeader>
				<CardContent className="text-xs text-muted-foreground leading-relaxed">
					支持一键拷贝本地视频流 URL，可在 VLC 或 PotPlayer 中播放。
				</CardContent>
			</Card>
		</div>
	);
}

// 搜索结果卡片组件
interface SearchResultCardProps {
	item: SearchResultItem;
	index: number;
	onCopyMagnet: (magnet: string) => void;
	onPlay: (magnet: string, title: string) => void;
}
function SearchResultCard({
	item,
	index,
	onCopyMagnet,
	onPlay,
}: SearchResultCardProps) {
	return (
		<Card
			id={`torrent-item-${index}`}
			className="bg-card/50 hover:bg-card-hover border-white/5 hover:border-white/10 transition-all duration-300 group"
		>
			<CardHeader className="p-5 pb-3">
				<CardTitle className="text-base font-semibold leading-relaxed group-hover:text-primary transition-colors line-clamp-2">
					{item.title}
				</CardTitle>
			</CardHeader>
			<CardContent className="px-5 pb-4 pt-0 flex flex-wrap gap-4 text-xs text-muted-foreground items-center">
				<div className="flex items-center gap-1.5">
					<Clock className="h-3.5 w-3.5" />
					<span>{item.pub_date}</span>
				</div>
				<div className="flex items-center gap-1.5">
					<HardDrive className="h-3.5 w-3.5" />
					<span>{formatBytes(item.size)}</span>
				</div>
			</CardContent>
			<CardFooter className="px-5 py-3.5 bg-muted/10 border-t border-white/5 flex items-center justify-between gap-4">
				<a
					href={String(item.link)}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
					title="在浏览器中打开网页"
				>
					<Globe className="h-3.5 w-3.5" />🌐 网页
				</a>

				<div className="flex gap-2">
					<Button
						variant="secondary"
						size="sm"
						onClick={() => onCopyMagnet(item.magnet)}
						className="h-8 text-xs font-medium"
					>
						🧲 复制磁力
					</Button>
					<Button
						variant="default"
						size="sm"
						onClick={() => onPlay(item.magnet, item.title)}
						className="h-8 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
					>
						▶ 边下边播
					</Button>
				</div>
			</CardFooter>
		</Card>
	);
}

// 种子解析加载弹窗
function ResolvingMagnetOverlay({ visible }: { visible: boolean }) {
	return (
		<Dialog open={visible}>
			<DialogContent
				showCloseButton={false}
				className="sm:max-w-sm p-8 text-center flex flex-col items-center"
			>
				<DialogHeader className="flex flex-col items-center gap-2">
					<Loader2 className="h-10 w-10 text-primary animate-spin mb-2" />
					<DialogTitle className="text-base font-semibold">
						正在启动下载引擎并解析种子...
					</DialogTitle>
					<DialogDescription className="text-xs">
						首次连接 Peer 并下载 Metadata 可能需要较长时间，请稍等
					</DialogDescription>
				</DialogHeader>
			</DialogContent>
		</Dialog>
	);
}

// 种子播放与文件选择控制弹窗
interface TorrentModalProps {
	activeTorrent: AddTorrentResult | null;
	activeFileId: number | null;
	streamUrl: string | null;
	torrentStatus: TorrentStatusInfo | null;
	onClose: () => void;
	onClosePlayer: () => void;
	onStartPlayback: (fileId: number) => void;
	onCopyStreamUrl: () => void;
}
function TorrentModal({
	activeTorrent,
	activeFileId,
	streamUrl,
	torrentStatus,
	onClose,
	onClosePlayer,
	onStartPlayback,
	onCopyStreamUrl,
}: TorrentModalProps) {
	return (
		<Dialog
			open={activeTorrent !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				showCloseButton={false}
				className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden"
			>
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-muted/20">
					<DialogTitle
						className="text-lg font-bold text-foreground truncate pr-4"
						title={activeTorrent?.name || "未命名种子"}
					>
						{activeTorrent?.name || "未命名种子"}
					</DialogTitle>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 w-8 hover:bg-white/5 text-muted-foreground hover:text-foreground rounded-full flex items-center justify-center"
						onClick={onClose}
					>
						✕
					</Button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-6">
					{activeTorrent &&
						(activeFileId === null ? (
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
										<Film className="h-4 w-4 text-primary" />
										选择要播放的文件：
									</h3>
									<Badge variant="secondary" className="text-xs">
										共 {activeTorrent.files.length} 个文件
									</Badge>
								</div>
								<ScrollArea className="h-[300px] border border-white/5 rounded-lg bg-black/20 p-2">
									<div className="space-y-1">
										{activeTorrent.files.map((file) => (
											<div
												key={file.id}
												className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5 transition-all group"
											>
												<div className="flex items-start gap-3 flex-1 min-w-0 pr-4">
													<FileVideo className="h-4 w-4 text-muted-foreground group-hover:text-primary mt-0.5 flex-shrink-0" />
													<div className="min-w-0">
														<p
															className="text-sm font-medium text-foreground truncate"
															title={file.name}
														>
															{file.name}
														</p>
														<p className="text-xs text-muted-foreground mt-0.5">
															{formatBytes(file.len)}
														</p>
													</div>
												</div>
												<Button
													size="sm"
													onClick={() => onStartPlayback(file.id)}
													className="gap-1.5 h-8 flex-shrink-0"
												>
													▶ 播放
												</Button>
											</div>
										))}
									</div>
								</ScrollArea>
							</div>
						) : (
							<div className="space-y-6">
								<div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black shadow-inner">
									{streamUrl && (
										/* biome-ignore lint/a11y/useMediaCaption: no captions for local torrent stream */
										<video
											src={streamUrl}
											controls
											autoPlay
											className="h-full w-full object-contain"
										/>
									)}
								</div>

								<div className="space-y-4">
									{/* Progress & Speed */}
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
													? (torrentStatus.progress_bytes /
															torrentStatus.total_bytes) *
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
												{torrentStatus
													? formatBytes(torrentStatus.total_bytes)
													: "0 B"}
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
												Tauri 内置网页浏览器支持直接播放主流{" "}
												<strong>MP4 (H.264)</strong> 格式。 如果视频无法加载（如
												MKV、HEVC/H.265 等格式），您可以复制下方流地址，在
												VLC、PotPlayer 等外部播放器中直接打开播放：
											</AlertDescription>
										</div>
									</Alert>

									{/* Actions */}
									<div className="flex justify-end gap-3 pt-2">
										<Button
											variant="secondary"
											size="sm"
											onClick={onCopyStreamUrl}
											className="gap-1.5 h-9 font-medium"
										>
											📋 复制视频流地址
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={onClosePlayer}
											className="gap-1.5 h-9 font-medium"
										>
											⬅ 返回文件列表
										</Button>
									</div>
								</div>
							</div>
						))}
				</div>
			</DialogContent>
		</Dialog>
	);
}

// 提示消息列表容器
interface ToastContainerProps {
	toasts: ToastMessage[];
	onClose: (id: number) => void;
}
function ToastContainer({ toasts, onClose }: ToastContainerProps) {
	return (
		<div className="toast-container fixed bottom-4 right-4 z-[999] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
			{toasts.map((toast) => (
				<Alert
					key={toast.id.toString()}
					className="toast pointer-events-auto bg-card border border-white/10 text-card-foreground p-4 pr-10 rounded-lg shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom duration-300"
				>
					<span className="text-primary flex-shrink-0">🔔</span>
					<AlertDescription className="text-sm font-medium leading-relaxed">
						{toast.text}
					</AlertDescription>
					<AlertAction className="absolute top-1/2 -translate-y-1/2 right-3">
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 hover:bg-white/5 text-muted-foreground hover:text-foreground rounded-full flex-shrink-0 flex items-center justify-center p-0"
							aria-label="关闭提示"
							onClick={() => onClose(toast.id)}
						>
							<X className="h-3.5 w-3.5" />
						</Button>
					</AlertAction>
				</Alert>
			))}
		</div>
	);
}

// ==========================================
// 主应用入口 (Main Application Component)
// ==========================================
function App() {
	const [keyword, setKeyword] = useState("");
	const [results, setResults] = useState<SearchResultItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [toasts, setToasts] = useState<ToastMessage[]>([]);
	const [hasSearched, setHasSearched] = useState(false);

	// 边下边播状态
	const [isResolvingMagnet, setIsResolvingMagnet] = useState(false);
	const [activeTorrent, setActiveTorrent] = useState<AddTorrentResult | null>(
		null,
	);
	const [activeFileId, setActiveFileId] = useState<number | null>(null);
	const [streamUrl, setStreamUrl] = useState<string | null>(null);
	const [torrentStatus, setTorrentStatus] = useState<TorrentStatusInfo | null>(
		null,
	);

	const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const showToast = (text: string, duration = 3000) => {
		const id = Date.now() + Math.random();
		setToasts((prev) => [...prev, { id, text }]);
		setTimeout(() => {
			setToasts((prev) => prev.filter((toast) => toast.id !== id));
		}, duration);
	};

	// 自动清除轮询
	useEffect(() => {
		return () => {
			if (statusIntervalRef.current) {
				clearInterval(statusIntervalRef.current);
			}
		};
	}, []);

	async function handleSearch(e: FormEvent) {
		e.preventDefault();
		if (!keyword.trim()) return;

		setLoading(true);
		setError(null);
		setHasSearched(true);

		try {
			const data = await invoke<SearchResultItem[]>("search_dmhy", {
				keyword: keyword.trim(),
			});
			setResults(data);
		} catch (err) {
			console.error("Search failed:", err);
			setError(typeof err === "string" ? err : "搜索失败，请检查网络或重试");
			setResults([]);
		} finally {
			setLoading(false);
		}
	}

	const handleCopyMagnet = async (magnet: string) => {
		try {
			await navigator.clipboard.writeText(magnet);
			showToast("磁力链接已复制到剪贴板");
		} catch {
			showToast("复制失败，请手动复制");
		}
	};

	const handlePlay = async (magnet: string, title: string) => {
		setIsResolvingMagnet(true);
		showToast(`正在启动下载流媒体引擎: ${title.slice(0, 20)}...`);
		try {
			const result = await invoke<AddTorrentResult>("torrent_add_magnet", {
				magnet,
			});
			setActiveTorrent(result);
			showToast(`种子元数据解析成功，获取到 ${result.files.length} 个文件`);
		} catch (err) {
			console.error("Failed to add torrent:", err);
			showToast(
				`种子解析失败: ${typeof err === "string" ? err : "错误详情请见控制台"}`,
				10000,
			);
		} finally {
			setIsResolvingMagnet(false);
		}
	};

	const startPlayback = async (fileId: number) => {
		if (!activeTorrent) return;
		try {
			const url = await invoke<string>("torrent_get_stream_url", {
				infoHash: activeTorrent.info_hash,
				fileId,
			});
			setStreamUrl(url);
			setActiveFileId(fileId);

			// 获取初始状态
			const initialStatus = await invoke<TorrentStatusInfo>(
				"torrent_get_status",
				{
					infoHash: activeTorrent.info_hash,
				},
			);
			setTorrentStatus(initialStatus);

			// 启动轮询
			statusIntervalRef.current = setInterval(async () => {
				try {
					const status = await invoke<TorrentStatusInfo>("torrent_get_status", {
						infoHash: activeTorrent.info_hash,
					});
					setTorrentStatus(status);
				} catch (err) {
					console.error("Failed to fetch torrent status:", err);
				}
			}, 1500);
		} catch (err) {
			console.error("Failed to start playback:", err);
			showToast("无法获取视频流，启动播放失败", 10000);
		}
	};

	const handleCopyStreamUrl = async () => {
		if (!streamUrl) return;
		try {
			await navigator.clipboard.writeText(streamUrl);
			showToast("视频流地址已复制到剪贴板，可在外部播放器中播放");
		} catch {
			showToast("复制失败，请手动复制");
		}
	};

	const handleClosePlayer = () => {
		if (statusIntervalRef.current) {
			clearInterval(statusIntervalRef.current);
			statusIntervalRef.current = null;
		}
		setActiveFileId(null);
		setStreamUrl(null);
		setTorrentStatus(null);
	};

	const handleCloseModal = () => {
		handleClosePlayer();
		setActiveTorrent(null);
	};

	return (
		<main className="container max-w-4xl mx-auto px-4 py-10 flex flex-col min-h-screen">
			{/* 页面头部 */}
			<AppHeader />

			{/* 搜索区域 */}
			<SearchForm
				keyword={keyword}
				setKeyword={setKeyword}
				loading={loading}
				onSubmit={handleSearch}
			/>

			{/* 加载提示 */}
			{loading && <SearchLoading />}

			{/* 错误显示 */}
			{error && <ErrorBanner message={error} />}

			{/* 未搜索空状态或结果为空提示 */}
			{!loading &&
				!error &&
				(hasSearched && results.length === 0 ? (
					<div className="text-center py-20 space-y-2">
						<p className="text-muted-foreground font-medium">
							未找到相关资源，请换个关键词试试
						</p>
					</div>
				) : !hasSearched ? (
					<WelcomeGuide />
				) : null)}

			{/* 搜索结果列表 */}
			{!loading && !error && results.length > 0 && (
				<section className="w-full space-y-4">
					<div className="flex items-center justify-between border-b border-white/5 pb-2">
						<div className="results-count text-sm text-muted-foreground">
							找到{" "}
							<span className="font-semibold text-primary">
								{results.length}
							</span>{" "}
							个资源
						</div>
					</div>

					<div className="grid gap-4">
						{results.map((item, index) => (
							<SearchResultCard
								key={index.toString()}
								item={item}
								index={index}
								onCopyMagnet={handleCopyMagnet}
								onPlay={handlePlay}
							/>
						))}
					</div>
				</section>
			)}

			{/* 磁力元数据解析 Loading 遮罩 */}
			<ResolvingMagnetOverlay visible={isResolvingMagnet} />

			{/* 种子文件列表 & 播放播放器面板弹窗 */}
			<TorrentModal
				activeTorrent={activeTorrent}
				activeFileId={activeFileId}
				streamUrl={streamUrl}
				torrentStatus={torrentStatus}
				onClose={handleCloseModal}
				onClosePlayer={handleClosePlayer}
				onStartPlayback={startPlayback}
				onCopyStreamUrl={handleCopyStreamUrl}
			/>

			{/* Toasts */}
			<ToastContainer
				toasts={toasts}
				onClose={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
			/>
		</main>
	);
}

export default App;

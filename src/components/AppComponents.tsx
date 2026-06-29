import {
	Calendar,
	Clock,
	Download,
	Globe,
	HardDrive,
	Loader2,
	Search,
	Settings as SettingsIcon,
	X,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useDI } from "../di/DIContext";
import type { SearchResultItem, ToastMessage } from "../types";
import { formatBytes, formatLocalDate } from "../utils";

// 页面头部组件
export function AppHeader() {
	const location = useLocation();
	const { listTorrentsUseCase } = useDI();
	const [activeCount, setActiveCount] = useState<number>(0);

	useEffect(() => {
		const fetchActiveCount = async () => {
			try {
				const list = await listTorrentsUseCase.execute();
				const count = list.filter((t) => !t.finished && !t.paused).length;
				setActiveCount(count);
			} catch {}
		};

		fetchActiveCount();
		const interval = setInterval(fetchActiveCount, 3000);
		return () => {
			clearInterval(interval);
		};
	}, [listTorrentsUseCase]);

	const navItems = [
		{ path: "/", label: "搜索视频", icon: <Search className="h-3.5 w-3.5" /> },
		{
			path: "/calendar",
			label: "新番日历",
			icon: <Calendar className="h-3.5 w-3.5" />,
		},
		{
			path: "/downloads",
			label: "下载管理",
			icon: (
				<Download
					className={`h-3.5 w-3.5 transition-transform ${
						activeCount > 0 ? "animate-bounce text-cyan-400" : ""
					}`}
				/>
			),
		},
		{
			path: "/settings",
			label: "设置选项",
			icon: <SettingsIcon className="h-3.5 w-3.5" />,
		},
	];

	return (
		<header className="mb-10 space-y-5 flex flex-col items-center">
			<div className="text-center space-y-1.5">
				<Link to="/">
					<h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent drop-shadow-md select-none cursor-pointer hover:opacity-90 transition-opacity">
						Animesh
					</h1>
				</Link>
				<p className="text-muted-foreground text-xs font-light tracking-wide">
					BT 边下边播 & 磁力聚合搜索客户端
				</p>
			</div>

			{/* 导航标签栏 */}
			<nav className="flex bg-card/40 border border-white/5 p-1 rounded-xl shadow-lg backdrop-blur-md">
				{navItems.map((item) => {
					const isActive = location.pathname === item.path;
					return (
						<Link
							key={item.path}
							to={item.path}
							className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-300 ${
								isActive
									? "bg-primary text-primary-foreground shadow-md"
									: "text-muted-foreground hover:text-foreground hover:bg-white/5"
							}`}
						>
							{item.icon}
							<span>{item.label}</span>
							{item.path === "/downloads" && activeCount > 0 && (
								<Badge
									variant="secondary"
									className="ml-1.5 h-4.5 px-1.5 text-[9px] font-extrabold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full animate-pulse flex items-center justify-center"
								>
									{activeCount}
								</Badge>
							)}
						</Link>
					);
				})}
			</nav>
		</header>
	);
}

// 搜索栏组件
interface SearchFormProps {
	keyword: string;
	setKeyword: (val: string) => void;
	loading: boolean;
	onSubmit: (e: FormEvent) => void;
	searchEngine: string;
	setSearchEngine: (val: string) => void;
}
export function SearchForm({
	keyword,
	setKeyword,
	loading,
	onSubmit,
	searchEngine,
	setSearchEngine,
}: SearchFormProps) {
	return (
		<section className="max-w-2xl mx-auto w-full mb-8">
			<form
				onSubmit={onSubmit}
				className="relative flex items-center bg-card/40 backdrop-blur-md rounded-xl border border-white/10 shadow-lg p-1 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300"
			>
				<div className="flex items-center pl-3 gap-1">
					<Search className="h-5 w-5 text-muted-foreground shrink-0" />
					<Select
						value={searchEngine}
						onValueChange={setSearchEngine}
						disabled={loading}
					>
						<SelectTrigger className="h-8 border-0 bg-transparent py-0 px-2 shadow-none focus:ring-0 focus-visible:ring-0 text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer gap-1">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="dmhy">动漫花园</SelectItem>
							<SelectItem value="bangumi_moe">萌番组</SelectItem>
							<SelectItem value="mikan">蜜柑计划</SelectItem>
							<SelectItem value="nyaa">Nyaa</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="h-5 w-[1px] bg-white/10 self-center" />
				<Input
					id="search-input"
					data-testid="search-input"
					className="flex-1 pl-3 pr-28 py-6 bg-transparent border-0 ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
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
export function SearchLoading({ engine }: { engine?: string }) {
	const engineName =
		engine === "bangumi_moe"
			? "萌番组"
			: engine === "mikan"
				? "蜜柑计划"
				: engine === "nyaa"
					? "Nyaa"
					: "动漫花园";
	return (
		<div className="flex flex-col items-center justify-center py-20 space-y-4">
			<Loader2 className="h-10 w-10 text-primary animate-spin" />
			<p className="text-sm text-muted-foreground font-medium">
				正在获取 {engineName} 资源列表...
			</p>
		</div>
	);
}

// 错误横幅
export function ErrorBanner({ message }: { message: string }) {
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
export function WelcomeGuide() {
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
						🌐 边下边播
					</CardTitle>
				</CardHeader>
				<CardContent className="text-xs text-muted-foreground leading-relaxed">
					内置高性能 BT 流媒体播放引擎，无须等待下载完毕，边下边放。
				</CardContent>
			</Card>
			<Card className="bg-card/25 border-white/5">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-semibold flex items-center gap-2">
						🌐 外部播放
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
export function SearchResultCard({
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
					<span>{formatLocalDate(item.pub_date)}</span>
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

// 提示消息列表容器
interface ToastContainerProps {
	toasts: ToastMessage[];
	onClose: (id: number) => void;
}
export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
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

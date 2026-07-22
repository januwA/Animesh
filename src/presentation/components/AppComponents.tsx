import {
	Calendar,
	Download,
	Loader2,
	Search,
	Settings as SettingsIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTorrentStatus } from "@/presentation/context/TorrentStatusContext";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";

// 页面头部组件
export function AppHeader() {
	const location = useLocation();
	const { torrents } = useTorrentStatus();
	const activeCount = torrents.filter((t) => !t.finished && !t.paused).length;

	const navItems = [
		{
			path: "/",
			label: "搜索视频",
			icon: (
				<Search className="h-5 w-5 md:h-3.5 md:w-3.5 transition-transform group-hover/button:scale-105" />
			),
		},
		{
			path: "/calendar",
			label: "新番日历",
			icon: (
				<Calendar className="h-5 w-5 md:h-3.5 md:w-3.5 transition-transform group-hover/button:scale-105" />
			),
		},
		{
			path: "/downloads",
			label: "下载管理",
			icon: (
				<Download
					className={`h-5 w-5 md:h-3.5 md:w-3.5 transition-transform ${
						activeCount > 0
							? "animate-bounce text-cyan-400"
							: "group-hover/button:scale-105"
					}`}
				/>
			),
		},
		{
			path: "/settings",
			label: "设置选项",
			icon: (
				<SettingsIcon className="h-5 w-5 md:h-3.5 md:w-3.5 transition-transform group-hover/button:scale-105" />
			),
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

			{/* 导航标签栏 - 桌面端为顶部居中，移动端固定在底部悬浮 */}
			<nav className="flex bg-card/90 border border-border md:bg-card/40 md:border-border p-2 md:p-1 rounded-2xl md:rounded-xl shadow-2xl md:shadow-lg backdrop-blur-xl md:backdrop-blur-md fixed bottom-5 left-4 right-4 z-50 md:static md:bottom-auto md:left-auto md:right-auto md:z-auto justify-around md:justify-start">
				{navItems.map((item) => {
					const isActive = location.pathname === item.path;
					return (
						<Link
							key={item.path}
							to={item.path}
							className={`relative flex flex-col md:flex-row items-center gap-1 md:gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-xl md:rounded-lg text-[10px] md:text-xs font-medium md:font-semibold transition-all duration-300 ${
								isActive
									? "bg-primary/10 md:bg-primary text-foreground md:text-primary-foreground shadow-none md:shadow-md"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:text-accent-foreground"
							}`}
						>
							{/* 移动端激活态背景微光 */}
							{isActive && (
								<span className="absolute inset-0 bg-primary/10 rounded-xl blur-xs -z-10 md:hidden animate-fade-in" />
							)}
							{item.icon}
							<span className="hidden md:inline">{item.label}</span>
							<span className="inline md:hidden">
								{item.label.substring(0, 2)}
							</span>
							{item.path === "/downloads" && activeCount > 0 && (
								<Badge
									variant="secondary"
									className="absolute -top-1 -right-1 md:static md:ml-1.5 h-4.5 px-1.5 text-[9px] font-extrabold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full animate-pulse flex items-center justify-center" // style-ignore
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

// 页面懒加载 Loading 占位组件
export function PageLoader() {
	return (
		<div className="flex flex-col items-center justify-center py-20 space-y-4 animate-in fade-in duration-300">
			<Loader2 className="h-10 w-10 text-primary animate-spin" />
			<p className="text-sm text-muted-foreground font-medium">
				正在载入页面...
			</p>
		</div>
	);
}

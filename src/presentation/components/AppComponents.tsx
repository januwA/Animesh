import {
	Calendar,
	Download,
	Loader2,
	Search,
	Settings as SettingsIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTorrentStatus } from "@/presentation/context/TorrentStatusContext";
import { cn } from "@/presentation/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";

const iconClass =
	"h-5 w-5 md:h-4 md:w-4 transition-transform group-hover/button:scale-110";

const navItems = [
	{ path: "/", label: "搜索", icon: Search },
	{ path: "/calendar", label: "新番", icon: Calendar },
	{ path: "/downloads", label: "下载", icon: Download },
	{ path: "/settings", label: "设置", icon: SettingsIcon },
];

// 页面头部组件
export function AppHeader() {
	const location = useLocation();
	const { torrents } = useTorrentStatus();
	const activeCount = torrents.filter((t) => !t.finished && !t.paused).length;

	return (
		<header className="flex flex-col items-center">
			<nav
				className={cn(
					"flex justify-around p-2 rounded-2xl shadow-2xl backdrop-blur-xl fixed bottom-5 left-4 right-4 z-50",
					"bg-card/90 border border-border",
					"md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:w-auto md:justify-center md:gap-1 md:px-2 md:py-1.5 md:rounded-2xl md:shadow-xl md:backdrop-blur-2xl",
				)}
			>
				{navItems.map((item) => {
					const isActive = location.pathname === item.path;
					const Icon = item.icon;
					const isDownload = item.path === "/downloads";
					const showBounce = isDownload && activeCount > 0;

					return (
						<Link
							key={item.path}
							to={item.path}
							className={cn(
								"relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-medium transition-all duration-300",
								"md:flex-row md:gap-2 md:px-4 md:py-2.5 md:rounded-xl md:text-sm md:font-semibold",
								isActive
									? "bg-primary/10 text-foreground shadow-none md:bg-primary/15 md:text-primary md:shadow-sm"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:text-accent-foreground",
							)}
						>
							{isActive && (
								<span className="absolute inset-0 bg-primary/10 rounded-xl blur-xs -z-10 md:hidden animate-fade-in" />
							)}
							<Icon
								className={cn(
									iconClass,
									showBounce && "animate-bounce text-cyan-400",
								)}
							/>
							<span>{item.label}</span>
							{isDownload && activeCount > 0 && (
								<Badge
									variant="secondary"
									className="absolute -top-1 -right-1 md:static md:ml-2 h-4.5 px-1.5 text-[9px] font-extrabold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full animate-pulse flex items-center justify-center"
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

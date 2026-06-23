import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, FileVideo, Film, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppContext } from "../context/AppContext";
import type { AddTorrentResult } from "../types";
import { formatBytes } from "../utils";

export default function TorrentDetail() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const magnet = searchParams.get("magnet") || "";
	const title = searchParams.get("title") || "";

	const { showToast } = useAppContext();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [torrent, setTorrent] = useState<AddTorrentResult | null>(null);

	useEffect(() => {
		if (!magnet) {
			setError("未提供有效的磁力链接");
			setLoading(false);
			return;
		}

		let isMounted = true;
		setLoading(true);
		setError(null);

		// Resolve magnet
		invoke<AddTorrentResult>("torrent_add_magnet", { magnet })
			.then((result) => {
				if (isMounted) {
					setTorrent(result);
					setLoading(false);
					showToast(`种子元数据解析成功，获取到 ${result.files.length} 个文件`);
				}
			})
			.catch((err) => {
				if (isMounted) {
					console.error("Failed to add torrent:", err);
					const errMsg = typeof err === "string" ? err : "错误详情请见控制台";
					setError(errMsg);
					setLoading(false);
					showToast(`种子解析失败: ${errMsg}`, 10000);
				}
			});

		return () => {
			isMounted = false;
		};
	}, [magnet, showToast]);

	// Listen to Escape key to go back, keeping test compatibility
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				navigate("/");
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [navigate]);

	const handleStartPlayback = (fileId: number, fileName: string) => {
		if (!torrent) return;
		navigate(
			`/play/${torrent.info_hash}/${fileId}?magnet=${encodeURIComponent(
				magnet,
			)}&title=${encodeURIComponent(title)}&fileName=${encodeURIComponent(
				fileName,
			)}`,
		);
	};

	if (loading) {
		return (
			<div
				role="dialog"
				className="flex flex-col items-center justify-center py-20 text-center space-y-4"
			>
				<Loader2 className="h-12 w-12 text-primary animate-spin mb-2" />
				<h2 className="text-xl font-bold">正在启动下载引擎并解析种子...</h2>
				<p className="text-sm text-muted-foreground max-w-md">
					首次连接 Peer 并下载 Metadata 可能需要较长时间，请稍等
				</p>
				<Button
					variant="outline"
					onClick={() => navigate("/")}
					className="mt-4"
				>
					取消解析并返回
				</Button>
			</div>
		);
	}

	if (error || !torrent) {
		return (
			<div
				role="dialog"
				className="flex flex-col items-center justify-center py-20 text-center space-y-4"
			>
				<h2 className="text-xl font-bold text-destructive">种子解析失败</h2>
				<p className="text-sm text-muted-foreground max-w-md">
					{error || "未知错误"}
				</p>
				<Button
					variant="outline"
					onClick={() => navigate("/")}
					className="mt-4"
				>
					返回搜索页面
				</Button>
			</div>
		);
	}

	return (
		<div
			role="dialog"
			className="bg-card/30 border border-white/5 rounded-xl p-6 space-y-6"
		>
			{/* Header info */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
				<div className="space-y-1 flex-1 min-w-0">
					<h2
						className="text-xl font-bold truncate pr-4 text-foreground"
						title={torrent.name || "未命名种子"}
					>
						{torrent.name || "未命名种子"}
					</h2>
					<p className="text-xs text-muted-foreground font-mono truncate">
						Hash: {torrent.info_hash}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate("/")}
						className="h-8 gap-1 text-muted-foreground hover:text-foreground self-start md:self-auto"
					>
						<ArrowLeft className="h-4 w-4" />
						返回搜索
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 w-8 hover:bg-white/5 text-muted-foreground hover:text-foreground rounded-full flex items-center justify-center"
						onClick={() => navigate("/")}
					>
						✕
					</Button>
				</div>
			</div>

			{/* File List */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
						<Film className="h-4 w-4 text-primary" />
						选择要播放的文件：
					</h3>
					<Badge variant="secondary" className="text-xs">
						共 {torrent.files.length} 个文件
					</Badge>
				</div>
				<ScrollArea className="h-[400px] border border-white/5 rounded-lg bg-black/25 p-3">
					<div className="space-y-2">
						{torrent.files.map((file) => (
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
									onClick={() => handleStartPlayback(file.id, file.name)}
									className="gap-1.5 h-8 flex-shrink-0"
								>
									▶ 播放
								</Button>
							</div>
						))}
					</div>
				</ScrollArea>
			</div>
		</div>
	);
}

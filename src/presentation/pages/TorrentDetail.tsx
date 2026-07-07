import { ArrowLeft, FileVideo, Film, Loader2, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import type { AddTorrentResult } from "@/domain/torrent/TorrentSchemas";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import { ScrollArea } from "@/presentation/components/ui/scroll-area";
import { formatBytes, formatError } from "@/utils";

export default function TorrentDetail() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const magnet = searchParams.get("magnet") || "";
	const title = searchParams.get("title") || "";
	const infoHash = searchParams.get("infoHash") || "";

	const { resolveTorrentUseCase } = useDI();
	const [error, setError] = useState<string | null>(null);
	const [torrent, setTorrent] = useState<AddTorrentResult | null>(null);
	const [loading, setLoading] = useState(true);

	const handleBack = () => {
		navigate(-1);
	};

	useEffect(() => {
		if (!magnet && !infoHash) {
			setError("未提供有效的磁力链接或种子 Hash");
			setLoading(false);
			return;
		}

		const resolveTorrent = async () => {
			setLoading(true);
			setError(null);

			try {
				const result = await resolveTorrentUseCase.execute({
					magnet,
					infoHash,
					title,
				});
				setTorrent(result);
			} catch (err: unknown) {
				setError(`解析种子失败: ${formatError(err)}`);
			} finally {
				setLoading(false);
			}
		};

		resolveTorrent();
	}, [infoHash, title, magnet, resolveTorrentUseCase]);

	const handleStartPlayback = (fileId: number, fileName: string) => {
		// v8 ignore next
		if (!torrent) return;
		navigate(
			`/play/${torrent.info_hash}/${fileId}?title=${encodeURIComponent(
				title || torrent.name || /* v8 ignore next */ "",
			)}&fileName=${encodeURIComponent(fileName)}`,
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
				<Button variant="outline" onClick={handleBack} className="mt-4">
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
					{error || /* v8 ignore next */ "未知错误"}
				</p>
				<Button variant="outline" onClick={handleBack} className="mt-4">
					返回
				</Button>
			</div>
		);
	}

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

			<div
				role="dialog"
				className="bg-card/30 border border-white/5 rounded-xl p-6 space-y-6"
			>
				{/* Header info */}
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
					<div className="space-y-1 flex-1 min-w-0">
						<h2
							className="text-xl font-bold break-all pr-4 text-foreground"
							title={torrent.name || "未命名种子"}
						>
							{torrent.name || "未命名种子"}
						</h2>
						<p className="text-xs text-muted-foreground font-mono break-all">
							Hash: {torrent.info_hash}
						</p>
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
					<ScrollArea className="border border-white/5 rounded-lg bg-black/25 p-3">
						<div className="space-y-2">
							{torrent.files.map((file) => (
								<div
									key={file.id}
									className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5 transition-all group"
								>
									<div className="flex items-start gap-3 flex-1 min-w-0 pr-4">
										<FileVideo className="h-4 w-4 text-muted-foreground group-hover:text-primary mt-0.5 shrink-0" />
										<div className="min-w-0">
											<p
												className="text-sm font-medium text-foreground break-all"
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
										className="gap-1.5 h-8 shrink-0"
									>
										<Play className="h-3.5 w-3.5 fill-current" />
										播放
									</Button>
								</div>
							))}
						</div>
					</ScrollArea>
				</div>
			</div>
		</div>
	);
}

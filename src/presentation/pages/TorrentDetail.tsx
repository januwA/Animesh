import { ArrowLeft, FileVideo, Film, Loader2, Play } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useDI } from "@/di/DIContext";
import { Alert, AlertDescription } from "@/presentation/components/ui/alert";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { ScrollArea } from "@/presentation/components/ui/scroll-area";
import { useQuery } from "@/presentation/hooks/useQuery";
import { formatBytes, formatError } from "@/utils";
import { InvalidParamsView } from "../components/InvalidParamsView";

const torrentDetailParamsSchema = z
	.object({
		magnet: z
			.string()
			.default("")
			.transform((s) => s.trim()),
		title: z
			.string()
			.default("")
			.transform((s) => s.trim()),
		infoHash: z
			.string()
			.default("")
			.transform((s) => s.trim()),
	})
	.refine((p) => p.magnet !== "" || p.infoHash !== "", {
		message: "未提供有效的磁力链接或种子 Hash",
		path: ["source"],
	});

type TorrentDetailParams = z.infer<typeof torrentDetailParamsSchema>;

export default function TorrentDetail() {
	const [searchParams] = useSearchParams();

	const parsed = torrentDetailParamsSchema.safeParse({
		magnet: searchParams.get("magnet") ?? "",
		title: searchParams.get("title") ?? "",
		infoHash: searchParams.get("infoHash") ?? "",
	});
	if (!parsed.success) {
		return (
			<InvalidParamsView title="无效的种子详情参数" error={parsed.error} />
		);
	}

	return <TorrentDetailView {...parsed.data} />;
}

function TorrentDetailView({ magnet, title, infoHash }: TorrentDetailParams) {
	const navigate = useNavigate();

	const { resolveTorrentUseCase } = useDI();

	const {
		data: torrent,
		loading,
		error,
	} = useQuery(
		(ctx) => resolveTorrentUseCase.execute(ctx, { magnet, infoHash, title }),
		[magnet, infoHash, title, resolveTorrentUseCase],
	);

	const handleBack = () => {
		navigate(-1);
	};

	const errorMessage = error ? `解析种子失败: ${formatError(error)}` : null;

	const handleStartPlayback = (fileId: number, fileName: string) => {
		// v8 ignore next
		if (!torrent) return;
		navigate(
			`/play/${torrent.info_hash}/${fileId}?title=${encodeURIComponent(
				title || torrent.name || /* v8 ignore next */ "",
			)}&fileName=${encodeURIComponent(fileName)}`,
			{
				replace: true,
			},
		);
	};

	if (loading) {
		return (
			<Card className="py-20">
				<CardContent
					className="flex flex-col items-center justify-center text-center gap-4"
					role="dialog"
				>
					<Loader2 className="h-12 w-12 text-primary animate-spin mb-2" />
					<h2 className="text-xl font-bold">正在启动下载引擎并解析种子...</h2>
					<p className="text-sm text-muted-foreground max-w-md">
						首次连接 Peer 并下载 Metadata 可能需要较长时间，请稍等
					</p>
					<Button variant="outline" onClick={handleBack} className="mt-4">
						取消解析并返回
					</Button>
				</CardContent>
			</Card>
		);
	}

	if (errorMessage || !torrent) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-center gap-4">
				<Alert variant="destructive" className="max-w-md">
					<h2 className="text-xl font-bold">种子解析失败</h2>
					<AlertDescription>
						{errorMessage || /* v8 ignore next */ "未知错误"}
					</AlertDescription>
				</Alert>
				<Button variant="outline" onClick={handleBack}>
					返回
				</Button>
			</div>
		);
	}

	return (
		<div className="w-full flex flex-col gap-4 animate-in fade-in duration-300">
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

			<Card className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
				{/* Header info */}
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
					<div className="space-y-1 flex-1 min-w-0">
						<h2
							className="text-lg sm:text-xl font-bold break-all text-foreground"
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
					<ScrollArea className="border border-border rounded-lg bg-muted/30 p-3">
						<div className="flex flex-col gap-2">
							{torrent.files.map((file) => (
								<div
									key={file.id}
									className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg hover:bg-accent border border-transparent hover:border-border transition-all group gap-3"
								>
									<div className="flex items-start gap-3 flex-1 min-w-0">
										<FileVideo className="h-4 w-4 text-muted-foreground group-hover:text-primary mt-0.5 shrink-0" />
										<div className="min-w-0 flex-1">
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
										className="gap-1.5 h-8 shrink-0 w-full sm:w-auto"
									>
										<Play className="h-3.5 w-3.5 fill-current" />
										播放
									</Button>
								</div>
							))}
						</div>
					</ScrollArea>
				</div>
			</Card>
		</div>
	);
}

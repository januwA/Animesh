import { Background, WithCancel } from "ajanuw-context";
import {
	ArrowLeft,
	Calendar,
	ChevronDown,
	ChevronUp,
	Clock,
	Globe,
	Loader2,
	Star,
	Tv,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import type {
	BangumiEpisode,
	BangumiSubject,
} from "@/domain/bangumi/BangumiSchemas";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { formatError } from "@/utils";
import { ErrorBanner } from "../components/AppComponents";

export default function SubjectDetail() {
	const { subjectId } = useParams<{ subjectId: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const state = location.state as { name?: string; imageUrl?: string } | null;
	const { getBangumiSubjectUseCase, getBangumiEpisodesUseCase } = useDI();

	const [subject, setSubject] = useState<BangumiSubject | null>(null);
	const [episodes, setEpisodes] = useState<BangumiEpisode[]>([]);
	const [error, setError] = useState<string | null>(null);

	const [summaryExpanded, setSummaryExpanded] = useState(false);
	const [summaryHasMore, setSummaryHasMore] = useState(false);
	const summaryRef = useRef<HTMLParagraphElement>(null);

	// Reset summary expansion state when subject changes
	useEffect(() => {
		// Use subject?.id to satisfy dependency check
		if (subject?.id !== undefined) {
			setSummaryExpanded(false);
			setSummaryHasMore(false);
		} else {
			setSummaryExpanded(false);
			setSummaryHasMore(false);
		}
	}, [subject?.id]);

	// Check if summary overflows when collapsed
	useEffect(() => {
		const element = summaryRef.current;
		if (!element) return;

		// Use subject?.summary to satisfy dependency check
		void subject?.summary;

		if (!summaryExpanded) {
			const hasOverflow = element.scrollHeight > element.clientHeight;
			setSummaryHasMore(hasOverflow);
		}
	}, [subject?.summary, summaryExpanded]);

	const todayStr = useMemo(() => {
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, "0");
		const day = String(today.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}, []);

	useEffect(() => {
		if (!subjectId) return;

		setSubject(null);
		setEpisodes([]);
		setError(null);
		const [ctx, cancel] = WithCancel(Background);

		const fetchData = async () => {
			try {
				// Fetch subject detail and episodes in parallel
				const [subjectData, episodesData] = await Promise.all([
					getBangumiSubjectUseCase.execute(ctx, subjectId),
					getBangumiEpisodesUseCase.execute(ctx, subjectId),
				]);

				if (!ctx.err()) {
					setSubject(subjectData);
					// Sort episodes by sort order
					const sortedEps = [...episodesData].sort((a, b) => a.sort - b.sort);
					setEpisodes(sortedEps);
				}
			} catch (err: unknown) {
				if (!ctx.err()) {
					setError(`获取动漫详情失败: ${formatError(err)}`);
				}
			}
		};

		fetchData();

		return () => {
			cancel();
		};
	}, [subjectId, getBangumiSubjectUseCase, getBangumiEpisodesUseCase]);

	const handleEpisodeClick = (episode: BangumiEpisode) => {
		if (!subject) return;
		const name = subject.name_cn || subject.name;
		const epNum = String(episode.sort).padStart(2, "0");
		navigate(`/?keyword=${encodeURIComponent(`${name} ${epNum}`)}`);
	};

	const handleBack = () => {
		if (document.startViewTransition) {
			document.startViewTransition(() => {
				navigate(-1);
			});
		} else {
			navigate(-1);
		}
	};

	if (error) {
		return (
			<div className="space-y-4">
				<button
					type="button"
					onClick={handleBack}
					className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					<ArrowLeft className="h-4 w-4" />
					返回日历
				</button>
				<ErrorBanner message={error} />
			</div>
		);
	}

	const displayName =
		subject?.name_cn || subject?.name || state?.name || "加载中...";
	const originalName = subject
		? subject.name !== displayName
			? subject.name
			: ""
		: "";
	const imageUrl = subject?.images?.large || state?.imageUrl;

	return (
		<div className="w-full space-y-6 animate-in fade-in duration-300">
			{/* Navigation Header */}
			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={handleBack}
					className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					<ArrowLeft className="h-4 w-4" />
					返回日历
				</button>

				{subject && (
					<a
						href={`https://bgm.tv/subject/${subject.id}`}
						target="_blank"
						rel="noopener noreferrer"
						className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors px-2.5 py-1 rounded bg-white/5 hover:bg-white/10"
						onClick={async (e) => {
							e.stopPropagation();
							e.preventDefault();
							const url = `https://bgm.tv/subject/${subject.id}`;
							try {
								const { openUrl } = await import("@tauri-apps/plugin-opener");
								await openUrl(url);
							} catch {
								window.open(url, "_blank");
							}
						}}
						title={`在 Bangumi 打开: ${displayName}`}
					>
						<Globe className="h-3.5 w-3.5" />
						<span>详情</span>
					</a>
				)}
			</div>

			{/* Info Header Card */}
			<div className="relative overflow-hidden rounded-2xl border border-white/5 bg-card/20 p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8">
				{/* Poster Image */}
				<div className="w-full md:w-48 shrink-0 flex justify-center">
					{imageUrl ? (
						<img
							src={imageUrl}
							alt={displayName}
							style={
								{
									viewTransitionName: `anime-cover-${subjectId}`,
								} as React.CSSProperties
							}
							className="w-48 aspect-3/4 object-cover rounded-xl shadow-lg border border-white/10"
						/>
					) : (
						<div className="w-48 aspect-3/4 rounded-xl bg-muted flex items-center justify-center border border-white/5">
							<Tv className="h-12 w-12 text-muted-foreground" />
						</div>
					)}
				</div>

				{/* Title and Metadata */}
				<div className="flex-1 flex flex-col justify-between space-y-4">
					<div className="space-y-2">
						{subject ? (
							<div className="flex flex-wrap items-center gap-2">
								{subject.platform && (
									<Badge
										variant="secondary"
										className="gap-1 bg-white/5 border border-white/5 text-muted-foreground"
									>
										<Tv className="h-3 w-3" />
										{subject.platform}
									</Badge>
								)}
								{subject.date && (
									<Badge
										variant="secondary"
										className="gap-1 bg-white/5 border border-white/5 text-muted-foreground"
									>
										<Calendar className="h-3 w-3" />
										{subject.date}
									</Badge>
								)}
								{subject.eps !== undefined && subject.eps !== null && (
									<Badge
										variant="secondary"
										className="gap-1 bg-white/5 border border-white/5 text-muted-foreground"
									>
										<Clock className="h-3 w-3" />共 {subject.eps} 话
									</Badge>
								)}
							</div>
						) : (
							<div className="flex flex-wrap items-center gap-2 animate-pulse">
								<div className="h-5 w-16 bg-white/5 rounded-full" />
								<div className="h-5 w-24 bg-white/5 rounded-full" />
								<div className="h-5 w-16 bg-white/5 rounded-full" />
							</div>
						)}

						<h1 className="text-xl md:text-3xl font-bold tracking-tight text-foreground">
							{displayName}
						</h1>
						{originalName && (
							<p className="text-sm md:text-base text-muted-foreground italic font-normal">
								{originalName}
							</p>
						)}
					</div>

					{/* Ratings / Stats / Loading Status */}
					{subject ? (
						<div className="flex flex-wrap gap-6 items-center pt-2">
							{subject.rating && (
								<div className="flex items-center gap-2">
									<div className="flex items-center justify-center h-12 w-12 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
										<Star className="h-6 w-6 fill-current" />
									</div>
									<div>
										<div className="text-xl font-bold text-amber-500">
											{subject.rating.score.toFixed(1)}
										</div>
										<div className="text-xs text-muted-foreground">
											{subject.rating.total?.toLocaleString() ?? 0} 人评分
										</div>
									</div>
								</div>
							)}

							{subject.rating?.rank ? (
								<div className="flex items-center gap-2">
									<div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary border border-primary/20">
										<Tv className="h-6 w-6" />
									</div>
									<div>
										<div className="text-xl font-bold text-primary">
											Rank #{subject.rating.rank}
										</div>
										<div className="text-xs text-muted-foreground">
											Bangumi 排名
										</div>
									</div>
								</div>
							) : null}

							{subject.collection?.doing != null && (
								<div className="flex items-center gap-2">
									<div className="flex items-center justify-center h-12 w-12 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
										<Users className="h-6 w-6" />
									</div>
									<div>
										<div className="text-xl font-bold text-green-500">
											{subject.collection.doing.toLocaleString()}
										</div>
										<div className="text-xs text-muted-foreground">人在看</div>
									</div>
								</div>
							)}
						</div>
					) : (
						<div className="space-y-3 pt-2">
							<div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
								<Loader2 className="h-4 w-4 text-primary animate-spin" />
								<span>正在加载动漫详情...</span>
							</div>
							<div className="flex gap-4 animate-pulse">
								<div className="h-10 w-24 bg-white/5 rounded-lg" />
								<div className="h-10 w-24 bg-white/5 rounded-lg" />
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Synopsis / Summary */}
			{subject ? (
				subject.summary && (
					<Card className="bg-card/40 border border-white/5 rounded-xl">
						<CardContent className="p-6 space-y-2 relative overflow-hidden">
							<h2 className="text-sm font-semibold text-muted-foreground">
								剧情简介
							</h2>
							<div className="relative">
								<p
									ref={summaryRef}
									className={`text-sm text-foreground leading-relaxed whitespace-pre-wrap transition-all duration-300 ${
										!summaryExpanded ? "line-clamp-4" : ""
									}`}
								>
									{subject.summary}
								</p>

								{/* Gradient Mask for fade-out effect when collapsed and there's overflow */}
								{!summaryExpanded && summaryHasMore && (
									<div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#080a10]/95 via-[#080a10]/40 to-transparent pointer-events-none" />
								)}
							</div>

							{summaryHasMore && (
								<div className="flex justify-center pt-2">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setSummaryExpanded(!summaryExpanded)}
										className="h-8 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 bg-white/5 hover:bg-white/10 px-3 rounded-lg transition-colors"
									>
										{summaryExpanded ? (
											<>
												<span>收起</span>
												<ChevronUp className="h-3.5 w-3.5" />
											</>
										) : (
											<>
												<span>展开</span>
												<ChevronDown className="h-3.5 w-3.5" />
											</>
										)}
									</Button>
								</div>
							)}
						</CardContent>
					</Card>
				)
			) : (
				<Card className="bg-card/40 border border-white/5 rounded-xl animate-pulse">
					<CardContent className="p-6 space-y-2">
						<div className="h-4 w-20 bg-white/5 rounded" />
						<div className="space-y-2">
							<div className="h-3 w-full bg-white/5 rounded" />
							<div className="h-3 w-5/6 bg-white/5 rounded" />
							<div className="h-3 w-4/5 bg-white/5 rounded" />
						</div>
					</CardContent>
				</Card>
			)}

			{/* Episodes List */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-bold text-foreground">剧集列表</h2>
					{subject && (
						<Badge
							variant="outline"
							className="text-xs border-white/10 text-muted-foreground"
						>
							点击剧集卡片搜索种子资源
						</Badge>
					)}
				</div>

				{subject ? (
					episodes.length > 0 ? (
						<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
							{episodes.map((ep) => {
								const isAired = ep.airdate ? todayStr >= ep.airdate : false;
								return (
									<button
										key={ep.id}
										type="button"
										onClick={() => handleEpisodeClick(ep)}
										className={`group text-left flex items-start gap-3 p-3 rounded-xl transition-all duration-200 ${
											isAired
												? "bg-primary/5 border border-primary/20 hover:border-primary/30 hover:bg-primary/10"
												: "bg-card/30 border border-white/5 hover:border-primary/30 hover:bg-card/60"
										}`}
									>
										{/* Ep Number / Icon */}
										<div
											className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
												isAired
													? "bg-primary/15 group-hover:bg-primary/25"
													: "bg-white/5 group-hover:bg-primary/10"
											}`}
										>
											<span
												className={`text-sm font-bold transition-colors ${
													isAired
														? "text-primary"
														: "text-muted-foreground group-hover:text-primary"
												}`}
											>
												{String(ep.sort).padStart(2, "0")}
											</span>
										</div>

										{/* Ep Details */}
										<div className="flex-1 min-w-0 space-y-1">
											<div className="flex items-center gap-1.5 justify-between">
												<h3 className="text-sm font-medium leading-tight text-foreground group-hover:text-primary transition-colors">
													{ep.name_cn || ep.name}
												</h3>
											</div>
											<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
												{ep.duration && <span>时长 {ep.duration}</span>}
												{ep.airdate && <span>首播 {ep.airdate}</span>}
											</div>
										</div>
									</button>
								);
							})}
						</div>
					) : (
						<div className="text-center py-12 text-sm text-muted-foreground bg-card/20 border border-white/5 rounded-xl">
							暂无剧集数据
						</div>
					)
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 animate-pulse">
						{[1, 2, 3, 4, 5, 6].map((i) => (
							<div
								key={i}
								className="flex items-start gap-3 p-3 rounded-xl bg-card/30 border border-white/5 h-16"
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

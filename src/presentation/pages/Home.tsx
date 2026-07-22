import { Canceled } from "ajanuw-context";
import {
	Clock,
	ExternalLink,
	Globe,
	HardDrive,
	Loader2,
	Magnet,
	Play,
	Search,
	X,
} from "lucide-react";
import type { SubmitEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import type { AiSearchResultItem } from "@/domain/torrent/TorrentSchemas";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/presentation/components/ui/card";
import { Input } from "@/presentation/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/presentation/components/ui/select";
import { useRequestContext } from "@/presentation/hooks/useRequestContext";
import { formatBytes, formatError, formatLocalDate } from "@/utils";
import { ErrorBanner } from "../components/AppComponents";
import { useAppContext } from "../context/AppContext";

// 搜索栏组件
interface SearchFormProps {
	keyword: string;
	setKeyword: (val: string) => void;
	loading: boolean;
	onSubmit: (e: SubmitEvent) => void;
	searchEngine: string;
	setSearchEngine: (val: string) => void;
}

function SearchForm({
	keyword,
	setKeyword,
	loading,
	onSubmit,
	searchEngine,
	setSearchEngine,
}: SearchFormProps) {
	return (
		<section className="mx-auto w-full mb-8">
			<form
				onSubmit={onSubmit}
				className="relative flex items-center bg-card/40 backdrop-blur-md rounded-xl border border-border shadow-lg p-1 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300"
			>
				<div className="flex items-center pl-1.5 md:pl-3 gap-0.5 md:gap-1">
					<Search className="h-5 w-5 text-muted-foreground shrink-0 hidden md:block" />
					<Select
						value={searchEngine}
						onValueChange={setSearchEngine}
						disabled={loading}
					>
						<SelectTrigger className="h-8 border-0 bg-transparent py-0 px-1.5 md:px-2 shadow-none focus:ring-0 focus-visible:ring-0 text-xs md:text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer gap-0.5 md:gap-1 max-w-[70px] sm:max-w-[85px] md:max-w-none">
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
				<div className="h-5 w-[1px] bg-border self-center shrink-0" />
				<Input
					id="search-input"
					data-testid="search-input"
					className="flex-1 pl-2 md:pl-3 pr-12 md:pr-28 py-5 md:py-6 bg-transparent border-0 ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base min-w-0"
					value={keyword}
					onChange={(e) => setKeyword(e.target.value)}
					placeholder="输入动漫名称"
					disabled={loading}
				/>
				<Button
					type="submit"
					className="absolute right-1.5 md:right-2 w-9 md:w-auto h-9 md:h-10 px-0 md:px-6 font-medium flex items-center justify-center shrink-0"
					disabled={loading || !keyword.trim()}
				>
					{loading ? (
						<>
							<Loader2 className="h-4 w-4 animate-spin shrink-0" />
							<span className="hidden md:inline ml-2">搜索中...</span>
						</>
					) : (
						<>
							<Search className="h-4 w-4 md:hidden" />
							<span className="hidden md:inline">搜索</span>
						</>
					)}
				</Button>
			</form>
		</section>
	);
}

interface SearchLoadingProps {
	onCancel?: () => void;
}

// 搜索加载指示器
function SearchLoading({ onCancel }: SearchLoadingProps) {
	return (
		<div className="flex flex-col items-center justify-center py-20 space-y-4">
			<Loader2 className="h-10 w-10 text-primary animate-spin" />
			<p className="text-sm text-muted-foreground font-medium">
				正在获取资源列表...
			</p>
			{onCancel && (
				<Button
					variant="outline"
					size="sm"
					onClick={onCancel}
					className="text-xs text-muted-foreground hover:text-foreground mt-2"
				>
					取消搜索
				</Button>
			)}
		</div>
	);
}

// 初始引导推荐组件
function WelcomeGuide() {
	return (
		<div className="mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 opacity-75">
			<Card className="bg-card/25 border-border">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-semibold flex items-center gap-2">
						<Search className="h-4 w-4 text-primary" />
						聚合搜索
					</CardTitle>
				</CardHeader>
				<CardContent className="text-xs text-muted-foreground leading-relaxed">
					一键检索动漫花园资源列表，快速检索并汇总磁力资源。
				</CardContent>
			</Card>
			<Card className="bg-card/25 border-border">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-semibold flex items-center gap-2">
						<Play className="h-4 w-4 text-primary fill-current" />
						边下边播
					</CardTitle>
				</CardHeader>
				<CardContent className="text-xs text-muted-foreground leading-relaxed">
					内置高性能 BT 流媒体播放引擎，无须等待下载完毕，边下边放。
				</CardContent>
			</Card>
			<Card className="bg-card/25 border-border">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-semibold flex items-center gap-2">
						<ExternalLink className="h-4 w-4 text-primary" />
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
	item: AiSearchResultItem;
	index: number;
	onCopyMagnet: (magnet: string) => void;
	onPlay: (magnet: string, title: string) => void;
	isBestAi?: boolean;
}

function SearchResultCard({
	item,
	index,
	onCopyMagnet,
	onPlay,
	isBestAi = false,
}: SearchResultCardProps) {
	return (
		<Card
			id={`torrent-item-${index}`}
			className={
				isBestAi
					? "bg-gradient-to-br from-cyan-950/10 via-card/50 to-indigo-950/10 border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)] hover:border-primary/40 transition-all duration-300 group"
					: "bg-card/50 hover:bg-accent/10 border-border hover:border-muted-foreground/30 transition-all duration-300 group"
			}
		>
			<CardHeader className="p-5 pb-3">
				{item.ai_score !== undefined && (
					<div className="flex items-center gap-2 mb-2 flex-wrap text-[10px]">
						{isBestAi ? (
							<span className="bg-primary/20 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
								✨ AI 智能精选推荐
							</span>
						) : (
							<span className="bg-secondary text-muted-foreground border border-border px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
								🤖 AI 评分过滤
							</span>
						)}
						<span
							className={`px-2.5 py-0.5 rounded-full font-mono font-bold ${
								item.ai_score >= 80
									? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30" // style-ignore
									: "bg-amber-500/15 text-amber-500 border border-amber-500/30" // style-ignore
							}`}
						>
							匹配度: {item.ai_score}分
						</span>
					</div>
				)}
				<CardTitle className="text-base font-semibold leading-relaxed group-hover:text-primary transition-colors">
					{item.title}
				</CardTitle>
			</CardHeader>
			<CardContent className="px-5 pb-4 pt-0 flex flex-col gap-3">
				{item.ai_reason && (
					<div className="px-3 py-2 bg-cyan-500/10 dark:bg-cyan-950/20 border border-cyan-500/20 dark:border-cyan-500/10 rounded-lg text-xs text-cyan-800 dark:text-cyan-300/90 leading-relaxed font-medium">
						{" "}
						{/* style-ignore */}
						<span className="font-semibold text-cyan-600 dark:text-cyan-400">
							推荐理由：
						</span>
						{item.ai_reason}
					</div>
				)}
				<div className="flex flex-wrap gap-4 text-xs text-muted-foreground items-center">
					<div className="flex items-center gap-1.5">
						<Clock className="h-3.5 w-3.5" />
						<span>{formatLocalDate(item.pub_date)}</span>
					</div>
					<div className="flex items-center gap-1.5">
						<HardDrive className="h-3.5 w-3.5" />
						<span>{formatBytes(item.size)}</span>
					</div>
				</div>
			</CardContent>
			<CardFooter className="px-5 py-3.5 bg-muted/30 border-t border-border flex items-center justify-between gap-4">
				<a
					href={String(item.link)}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
					title="在浏览器中打开网页"
				>
					<Globe className="h-3.5 w-3.5" />
					网页
				</a>

				<div className="flex gap-2">
					<Button
						variant="secondary"
						size="sm"
						onClick={() => onCopyMagnet(item.magnet)}
						className="h-8 text-xs font-medium gap-1.5"
					>
						<Magnet className="h-3.5 w-3.5" />
						复制磁力
					</Button>
					<Button
						variant="default"
						size="sm"
						onClick={() => onPlay(item.magnet, item.title)}
						className="h-8 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
					>
						<Play className="h-3.5 w-3.5 fill-current" />
						边下边播
					</Button>
				</div>
			</CardFooter>
		</Card>
	);
}

export default function Home() {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const {
		searchTorrentsUseCase,
		searchTorrentsWithAiUseCase,
		getSettingsUseCase,
	} = useDI();
	const { showToast } = useAppContext();

	const [keyword, setKeyword] = useState("");
	const [results, setResults] = useState<AiSearchResultItem[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [searchEngine, setSearchEngine] = useState("dmhy");
	const [isSearching, setIsSearching] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);
	const [selectedAiAlias, setSelectedAiAlias] = useState<string>(
		() => localStorage.getItem("animesh_selected_ai_alias") || "none",
	);
	const [aiConfigs, setAiConfigs] = useState<AiConfig[]>([]);
	const { createContext, cancel: cancelSearch } = useRequestContext();
	const handleCancelSearch = useCallback(() => {
		cancelSearch();
		setIsSearching(false);
	}, [cancelSearch]);

	const [history, setHistory] = useState<string[]>(() => {
		try {
			const raw = localStorage.getItem("animesh_search_history");
			return raw ? JSON.parse(raw) : [];
		} catch {
			return [];
		}
	});

	// 检测本地 AI 配置
	useEffect(() => {
		const checkAi = async () => {
			try {
				const settings = await getSettingsUseCase.execute();
				const configs = settings.ai_configs || [];
				setAiConfigs(configs);
			} catch {
				// 静默退化
			}
		};
		checkAi();
	}, [getSettingsUseCase]);

	const keywordParam = searchParams.get("keyword");

	const performSearch = useCallback(
		(queryText: string) => {
			setError(null);
			setHasSearched(true);

			setHistory((prev) => {
				const filtered = prev.filter((item) => item !== queryText);
				const nextHistory = [queryText, ...filtered];
				localStorage.setItem(
					"animesh_search_history",
					JSON.stringify(nextHistory),
				);
				return nextHistory;
			});

			const ctx = createContext();
			setIsSearching(true);

			(async () => {
				try {
					const data =
						selectedAiAlias !== "none"
							? await searchTorrentsWithAiUseCase.execute(ctx, {
									keyword: queryText,
									engine: searchEngine,
									aiAlias: selectedAiAlias,
								})
							: await searchTorrentsUseCase.execute(ctx, {
									keyword: queryText,
									engine: searchEngine,
								});
					/* v8 ignore next */
					if (ctx.err()) return;
					setResults(data);
				} catch (err: unknown) {
					if (ctx.err() === Canceled) {
						return;
					}
					setError(`搜索失败，请检查网络或重试: ${formatError(err)}`);
					setResults([]);
				} finally {
					if (ctx.err() === null) {
						setIsSearching(false);
					}
				}
			})();
		},
		[
			searchTorrentsUseCase,
			searchTorrentsWithAiUseCase,
			searchEngine,
			selectedAiAlias,
			createContext,
		],
	);

	useEffect(() => {
		if (keywordParam) {
			const query = keywordParam.trim();
			if (query) {
				setKeyword(query);
				setSearchParams({}, { replace: true });
				performSearch(query);
			}
		}
	}, [keywordParam, setSearchParams, performSearch]);

	function handleSearch(e: SubmitEvent) {
		e.preventDefault();
		const query = keyword.trim();
		if (!query) return;

		performSearch(query);
	}

	const handleHistoryClick = (item: string) => {
		setKeyword(item);
		performSearch(item);
	};

	const handleDeleteHistory = (item: string) => {
		setHistory((prev) => {
			const nextHistory = prev.filter((x) => x !== item);
			if (nextHistory.length === 0) {
				localStorage.removeItem("animesh_search_history");
			} else {
				localStorage.setItem(
					"animesh_search_history",
					JSON.stringify(nextHistory),
				);
			}
			return nextHistory;
		});
	};

	const handleClearHistory = () => {
		setHistory([]);
		localStorage.removeItem("animesh_search_history");
	};

	const handleCopyMagnet = async (magnet: string) => {
		try {
			await navigator.clipboard.writeText(magnet);
			showToast("磁力链接已复制到剪贴板", "success");
		} catch {
			showToast("复制失败，请手动复制", "error");
		}
	};

	const handlePlay = (magnet: string, title: string) => {
		navigate(
			`/torrent?magnet=${encodeURIComponent(magnet)}&title=${encodeURIComponent(title)}`,
		);
	};

	return (
		<>
			{/* 搜索区域 */}
			<SearchForm
				keyword={keyword}
				setKeyword={setKeyword}
				loading={isSearching}
				onSubmit={handleSearch}
				searchEngine={searchEngine}
				setSearchEngine={setSearchEngine}
			/>

			{/* AI 智能过滤开关 */}
			{aiConfigs.length > 0 && (
				<div className="mx-auto w-full mb-6 mt-[-1rem] flex items-center justify-end animate-in fade-in duration-200">
					<div className="flex items-center gap-2 bg-card border border-border backdrop-blur-md px-3 py-1 rounded-lg shadow-sm hover:border-muted-foreground/30 transition-all duration-300">
						<span className="text-[11px] font-medium text-muted-foreground select-none pl-1 flex items-center gap-1">
							✨ AI 智能过滤:
						</span>
						<Select
							value={selectedAiAlias}
							onValueChange={(val) => {
								setSelectedAiAlias(val);
								localStorage.setItem("animesh_selected_ai_alias", val);
							}}
							disabled={isSearching}
						>
							<SelectTrigger className="h-7 border-0 bg-transparent py-0 px-2 shadow-none focus:ring-0 focus-visible:ring-0 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer gap-1">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">不使用 AI (传统搜索)</SelectItem>
								{aiConfigs.map((config) => (
									<SelectItem key={config.alias} value={config.alias}>
										{config.alias}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			)}

			{/* 搜索历史记录 */}
			{history.length > 0 && (
				<div className="mx-auto w-full mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200">
					<span className="flex items-center gap-1 font-medium">
						<Clock className="h-3.5 w-3.5" />
						最近搜索:
					</span>
					{history.map((item) => (
						<Badge
							key={item}
							variant="secondary"
							className="cursor-pointer hover:bg-secondary/80 flex items-center gap-1 px-2.5 py-0.5"
							onClick={() => handleHistoryClick(item)}
						>
							{item}
							<button
								type="button"
								data-testid={`delete-history-${item}`}
								onClick={(e) => {
									e.stopPropagation();
									handleDeleteHistory(item);
								}}
								className="text-muted-foreground hover:text-foreground rounded-full p-0.5 hover:bg-accent transition-colors"
							>
								<X className="h-3 w-3" />
							</button>
						</Badge>
					))}
					<Button
						variant="ghost"
						size="sm"
						className="h-6 px-2 text-[10px] ml-auto text-muted-foreground hover:text-foreground cursor-pointer"
						onClick={handleClearHistory}
					>
						清空
					</Button>
				</div>
			)}

			{/* 加载提示 */}
			{isSearching &&
				(selectedAiAlias !== "none" ? (
					<div className="flex flex-col items-center justify-center py-20 space-y-4 animate-in fade-in duration-300">
						<div className="relative flex items-center justify-center">
							<Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
							<div className="absolute inset-0 rounded-full bg-cyan-400/10 blur-xl animate-pulse" />{" "}
							{/* style-ignore */}
						</div>
						<p className="text-sm font-semibold bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-400 bg-clip-text text-transparent animate-pulse">
							AI 正在搜索，可能需要数秒，请稍候...
						</p>
						<p className="text-xs text-muted-foreground max-w-xs text-center leading-relaxed">
							正在分析意图，并根据需要在不同搜索引擎间自动检索 Fallback...
						</p>
						{handleCancelSearch && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleCancelSearch}
								className="text-xs text-muted-foreground hover:text-foreground mt-2 border-border bg-secondary/50"
							>
								取消搜索
							</Button>
						)}
					</div>
				) : (
					<SearchLoading onCancel={handleCancelSearch} />
				))}

			{/* 错误显示 */}
			{error && <ErrorBanner message={error} />}

			{/* 未搜索空状态或结果为空提示 */}
			{!isSearching &&
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
			{!isSearching && !error && results.length > 0 && (
				<section className="w-full space-y-4">
					<div className="flex items-center justify-between border-b border-border pb-2">
						<div className="results-count text-sm text-muted-foreground">
							找到{" "}
							<span className="font-semibold text-primary">
								{results.length}
							</span>{" "}
							个资源
						</div>
					</div>

					<div className="grid gap-4">
						{results.map((item, index) => {
							const isBest =
								selectedAiAlias !== "none" &&
								index === 0 &&
								item.ai_score !== undefined;
							return (
								<SearchResultCard
									key={index.toString()}
									item={item}
									index={index}
									onCopyMagnet={handleCopyMagnet}
									onPlay={handlePlay}
									isBestAi={isBest}
								/>
							);
						})}
					</div>
				</section>
			)}
		</>
	);
}

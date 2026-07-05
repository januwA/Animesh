import { Clock, X } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRequestContext } from "@/hooks/useRequestContext";
import { formatError } from "@/utils";
import {
	ErrorBanner,
	SearchForm,
	SearchLoading,
	SearchResultCard,
	WelcomeGuide,
} from "../components/AppComponents";
import { useAppContext } from "../context/AppContext";
import { useDI } from "../di/DIContext";
import { Canceled } from "../shared/context/interface";

export default function Home() {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const { searchTorrentsUseCase } = useDI();
	const {
		keyword,
		setKeyword,
		results,
		setResults,
		error,
		setError,
		hasSearched,
		setHasSearched,
		showToast,
		searchEngine,
		setSearchEngine,
	} = useAppContext();

	const [isSearching, setIsSearching] = useState(false);
	const { createContext, cancel: cancelSearch } = useRequestContext();

	const [history, setHistory] = useState<string[]>(() => {
		try {
			const raw = localStorage.getItem("animesh_search_history");
			return raw ? JSON.parse(raw) : [];
		} catch {
			return [];
		}
	});

	const keywordParam = searchParams.get("keyword");

	const performSearch = useCallback(
		(queryText: string) => {
			setError(null);
			setHasSearched(true);

			const trimmed = queryText.trim();
			if (trimmed) {
				setHistory((prev) => {
					const filtered = prev.filter((item) => item !== trimmed);
					const nextHistory = [trimmed, ...filtered];
					localStorage.setItem(
						"animesh_search_history",
						JSON.stringify(nextHistory),
					);
					return nextHistory;
				});
			}

			const ctx = createContext();
			setIsSearching(true);

			(async () => {
				try {
					const data = await searchTorrentsUseCase.execute(ctx, {
						keyword: queryText,
						engine: searchEngine,
					});
					setResults(data);
				} catch (err: unknown) {
					if (ctx.err() === Canceled) {
						return;
					}
					setError(`搜索失败，请检查网络或重试: ${formatError(err)}`);
					setResults([]);
				} finally {
					setIsSearching(false);
				}
			})();
		},
		[
			searchTorrentsUseCase,
			searchEngine,
			setError,
			setHasSearched,
			setResults,
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
	}, [keywordParam, setKeyword, setSearchParams, performSearch]);

	function handleSearch(e: FormEvent) {
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
			showToast("磁力链接已复制到剪贴板");
		} catch {
			showToast("复制失败，请手动复制");
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

			{/* 搜索历史记录 */}
			{history.length > 0 && (
				<div className="max-w-2xl mx-auto w-full mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200">
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
								className="text-muted-foreground hover:text-foreground rounded-full p-0.5 hover:bg-white/10 transition-colors"
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
			{isSearching && <SearchLoading onCancel={cancelSearch} />}

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
		</>
	);
}

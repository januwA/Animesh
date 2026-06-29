import type { FormEvent } from "react";
import { useEffect, useTransition } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
	ErrorBanner,
	SearchForm,
	SearchLoading,
	SearchResultCard,
	WelcomeGuide,
} from "../components/AppComponents";
import { useAppContext } from "../context/AppContext";
import { useDI } from "../di/DIContext";

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

	const [isPending, startTransition] = useTransition();

	const keywordParam = searchParams.get("keyword");

	useEffect(() => {
		if (keywordParam) {
			const query = keywordParam.trim();
			if (query) {
				setKeyword(query);
				setHasSearched(true);
				setError(null);
				setSearchParams({}, { replace: true });

				startTransition(async () => {
					try {
						const data = await searchTorrentsUseCase.execute(
							query,
							searchEngine,
						);
						setResults(data || []);
					} catch (err: unknown) {
						console.error("Search failed:", err);
						setError(
							typeof err === "string" ? err : "搜索失败，请检查网络或重试",
						);
						setResults([]);
					}
				});
			}
		}
	}, [
		keywordParam,
		setKeyword,
		setHasSearched,
		setError,
		setResults,
		searchTorrentsUseCase,
		setSearchParams,
		searchEngine,
	]);

	function handleSearch(e: FormEvent) {
		e.preventDefault();
		if (!keyword.trim()) return;

		setError(null);
		setHasSearched(true);

		startTransition(async () => {
			try {
				const data = await searchTorrentsUseCase.execute(
					keyword.trim(),
					searchEngine,
				);
				setResults(data || []);
			} catch (err: unknown) {
				console.error("Search failed:", err);
				setError(typeof err === "string" ? err : "搜索失败，请检查网络或重试");
				setResults([]);
			}
		});
	}

	const handleCopyMagnet = async (magnet: string) => {
		try {
			await navigator.clipboard.writeText(magnet);
			showToast("磁力链接已复制到剪贴板");
		} catch {
			showToast("复制失败，请手动复制");
		}
	};

	const handlePlay = (magnet: string, title: string) => {
		showToast(`正在启动下载流媒体引擎: ${title.slice(0, 20)}...`);
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
				loading={isPending}
				onSubmit={handleSearch}
				searchEngine={searchEngine}
				setSearchEngine={setSearchEngine}
			/>

			{/* 加载提示 */}
			{isPending && <SearchLoading engine={searchEngine} />}

			{/* 错误显示 */}
			{error && <ErrorBanner message={error} />}

			{/* 未搜索空状态或结果为空提示 */}
			{!isPending &&
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
			{!isPending && !error && results.length > 0 && (
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

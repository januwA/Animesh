import type { FormEvent } from "react";
import { useCallback, useEffect, useTransition } from "react";
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

	const performSearch = useCallback(
		(queryText: string) => {
			setError(null);
			setHasSearched(true);

			startTransition(async () => {
				try {
					const data = await searchTorrentsUseCase.execute(
						queryText,
						searchEngine,
					);
					setResults(data);
				} catch (err: unknown) {
					setError(
						typeof err === "string" ? err : "搜索失败，请检查网络或重试",
					);
					setResults([]);
				}
			});
		},
		[searchTorrentsUseCase, searchEngine, setError, setHasSearched, setResults],
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
				loading={isPending}
				onSubmit={handleSearch}
				searchEngine={searchEngine}
				setSearchEngine={setSearchEngine}
			/>

			{/* 加载提示 */}
			{isPending && <SearchLoading />}

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

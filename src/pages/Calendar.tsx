import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorBanner, SearchLoading } from "../components/AppComponents";
import { WeeklyCalendar } from "../components/WeeklyCalendar";
import { useDI } from "../di/DIContext";
import type { BangumiCalendarDay } from "../types";

export default function Calendar() {
	const navigate = useNavigate();
	const { getBangumiCalendarUseCase } = useDI();
	const [calendar, setCalendar] = useState<BangumiCalendarDay[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let isMounted = true;
		setLoading(true);
		setError(null);

		getBangumiCalendarUseCase
			.execute()
			.then((data) => {
				if (isMounted) {
					setCalendar(data);
				}
			})
			.catch((err: unknown) => {
				console.error("Failed to fetch calendar:", err);
				if (isMounted) {
					setError("获取新番日历失败，请检查网络或重试");
				}
			})
			.finally(() => {
				if (isMounted) {
					setLoading(false);
				}
			});

		return () => {
			isMounted = false;
		};
	}, [getBangumiCalendarUseCase]);

	const handleAnimeClick = (animeName: string) => {
		navigate(`/?keyword=${encodeURIComponent(animeName)}`);
	};

	return (
		<div className="w-full space-y-4">
			{loading && <SearchLoading />}
			{error && <ErrorBanner message={error} />}
			{!loading && !error && calendar.length > 0 && (
				<WeeklyCalendar calendar={calendar} onAnimeClick={handleAnimeClick} />
			)}
			{!loading && !error && calendar.length === 0 && (
				<div className="text-center py-20 text-muted-foreground">
					未找到新番数据，请稍后重试
				</div>
			)}
		</div>
	);
}

import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useNavigate } from "react-router-dom";
import type { BangumiCalendarDay } from "@/domain/bangumi/BangumiSchemas";
import { ErrorBanner } from "../components/AppComponents";
import { WeeklyCalendar } from "../components/WeeklyCalendar";
import { useDI } from "../di/DIContext";

export default function Calendar() {
	const navigate = useNavigate();
	const { getBangumiCalendarUseCase } = useDI();
	const [calendar, setCalendar] = useState<BangumiCalendarDay[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		setError(null);

		startTransition(async () => {
			try {
				const data = await getBangumiCalendarUseCase.execute();
				setCalendar(data);
			} catch (_err: unknown) {
				setError("获取新番日历失败，请检查网络或重试");
			}
		});
	}, [getBangumiCalendarUseCase]);

	const handleAnimeClick = (animeName: string) => {
		navigate(`/?keyword=${encodeURIComponent(animeName)}`);
	};

	return (
		<div className="w-full space-y-4">
			{isPending && (
				<div className="flex flex-col items-center justify-center py-20 space-y-4">
					<Loader2 className="h-10 w-10 text-primary animate-spin" />
					<p className="text-sm text-muted-foreground font-medium">
						正在获取新番日历...
					</p>
				</div>
			)}
			{error && <ErrorBanner message={error} />}
			{!isPending && !error && calendar.length > 0 && (
				<WeeklyCalendar calendar={calendar} onAnimeClick={handleAnimeClick} />
			)}
			{!isPending && !error && calendar.length === 0 && (
				<div className="text-center py-20 text-muted-foreground">
					未找到新番数据，请稍后重试
				</div>
			)}
		</div>
	);
}

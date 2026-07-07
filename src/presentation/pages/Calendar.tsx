import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Background, WithCancel } from "@/crosscutting/context/context";
import { useDI } from "@/di/DIContext";
import type { BangumiCalendarItem } from "@/domain/bangumi/BangumiSchemas";
import { formatError } from "@/utils";
import { ErrorBanner } from "../components/AppComponents";
import { WeeklyCalendar } from "../components/WeeklyCalendar";
import { useAppContext } from "../context/AppContext";

export default function Calendar() {
	const navigate = useNavigate();
	const { getBangumiCalendarUseCase } = useDI();
	const { calendar, setCalendar } = useAppContext();
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		if (calendar.length > 0) {
			return;
		}
		setError(null);
		setIsLoading(true);
		const [ctx, cancel] = WithCancel(Background);

		(async () => {
			try {
				const data = await getBangumiCalendarUseCase.execute(ctx);
				if (!ctx.err()) {
					setCalendar(data);
				}
			} catch (err: unknown) {
				if (!ctx.err()) {
					setError(`获取新番日历失败，请检查网络或重试: ${formatError(err)}`);
				}
			} finally {
				if (!ctx.err()) {
					setIsLoading(false);
				}
			}
		})();

		return () => {
			cancel();
		};
	}, [getBangumiCalendarUseCase, calendar.length, setCalendar]);

	const handleAnimeClick = (item: BangumiCalendarItem) => {
		navigate(`/subject/${item.id}`, {
			viewTransition: true,
			state: {
				name: item.name_cn || item.name,
				imageUrl: item.images?.large,
			},
		});
	};

	return (
		<div className="w-full space-y-4">
			{isLoading && (
				<div className="flex flex-col items-center justify-center py-20 space-y-4">
					<Loader2 className="h-10 w-10 text-primary animate-spin" />
					<p className="text-sm text-muted-foreground font-medium">
						正在获取新番日历...
					</p>
				</div>
			)}
			{error && <ErrorBanner message={error} />}
			{!isLoading && !error && calendar.length > 0 && (
				<WeeklyCalendar calendar={calendar} onAnimeClick={handleAnimeClick} />
			)}
			{!isLoading && !error && calendar.length === 0 && (
				<div className="text-center py-20 text-muted-foreground">
					未找到新番数据，请稍后重试
				</div>
			)}
		</div>
	);
}

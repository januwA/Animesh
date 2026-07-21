import { Background, WithCancel } from "ajanuw-context";
import { Calendar as CalendarIcon, Loader2, Star, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import type {
	BangumiCalendarDay,
	BangumiCalendarItem,
} from "@/domain/bangumi/BangumiSchemas";
import { formatError } from "@/utils";
import { ErrorBanner } from "../components/AppComponents";
import { LazyImage } from "../components/LazyImage";
import { Button } from "../components/ui/button";
import { useAppContext } from "../context/AppContext";

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function getTodayWeekdayId(): number {
	const jsDay = new Date().getDay();
	return jsDay === 0 ? 7 : jsDay;
}

interface WeeklyCalendarProps {
	calendar: BangumiCalendarDay[];
	onAnimeClick: (item: BangumiCalendarItem) => void;
}

function WeeklyCalendar({ calendar, onAnimeClick }: WeeklyCalendarProps) {
	const { calendarActiveDay, setCalendarActiveDay } = useAppContext();
	const todayId = useMemo(() => getTodayWeekdayId(), []);

	const activeDay = calendarActiveDay ?? todayId;

	const setActiveDay = (dayId: number) => {
		setCalendarActiveDay(dayId);
	};

	// 优化：直接在 7 个元素的 calendar 数组中进行查找，避免 Map 实例的额外创建与开销
	const currentItems = useMemo(() => {
		return calendar.find((day) => day.weekday.id === activeDay)?.items ?? [];
	}, [calendar, activeDay]);

	return (
		<section className="w-full">
			{/* Weekday Tabs */}
			<div className="sticky-safe-top z-10 bg-background/85 backdrop-blur-md pt-2 pb-2 -mx-4 px-4">
				<div className="flex gap-1 p-1 bg-muted/60 border border-border/80 rounded-xl shadow-inner">
					{WEEKDAY_LABELS.map((label, index) => {
						const dayId = index + 1;
						const isActive = dayId === activeDay;
						const isToday = dayId === todayId;

						return (
							<Button
								key={dayId}
								variant={isActive ? "default" : "ghost"}
								size="sm"
								className={`flex-1 text-xs relative transition-all ${
									isActive
										? "bg-primary text-primary-foreground font-bold shadow-md"
										: "text-muted-foreground/90 font-semibold hover:text-foreground hover:bg-background/50"
								}`}
								onClick={() => setActiveDay(dayId)}
							>
								{label}
								{isToday && !isActive && (
									<span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
								)}
							</Button>
						);
					})}
				</div>
			</div>

			{/* Anime Grid */}
			<div
				className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
				style={{ transform: "translate3d(0, 0, 0)" }}
			>
				{currentItems.map((item) => (
					<AnimeCard
						key={item.id}
						item={item}
						onClick={() => onAnimeClick(item)}
					/>
				))}
			</div>

			{currentItems.length === 0 && (
				<div className="text-center py-10 text-sm text-muted-foreground">
					暂无更新
				</div>
			)}
		</section>
	);
}

interface AnimeCardProps {
	item: BangumiCalendarItem;
	onClick: () => void;
}

function AnimeCard({ item, onClick }: AnimeCardProps) {
	const displayName = item.name_cn || item.name;

	return (
		<div className="group flex flex-col bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-all duration-200 text-left relative">
			<button
				type="button"
				onClick={onClick}
				className="flex flex-col flex-1 w-full text-left"
				title={`详情: ${displayName}`}
			>
				{/* Cover Image */}
				{item.images?.large ? (
					<div className="aspect-3/4 w-full overflow-hidden bg-muted">
						<LazyImage
							src={item.images.large}
							alt={displayName}
							style={
								{
									viewTransitionName: `anime-cover-${item.id}`,
								} as React.CSSProperties
							}
							className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
						/>
					</div>
				) : (
					<div className="aspect-3/4 w-full bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center">
						<CalendarIcon className="h-8 w-8 text-primary/30" />
					</div>
				)}

				{/* Info */}
				<div className="p-2 space-y-1 flex-1 flex flex-col w-full">
					<h3 className="text-xs font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
						{displayName}
					</h3>

					<div className="flex items-center gap-2 mt-auto pt-1">
						{item.rating && (
							<span className="flex items-center gap-0.5 text-[10px] text-amber-400">
								<Star className="h-2.5 w-2.5 fill-current" />
								{item.rating.score.toFixed(1)}
							</span>
						)}
						{item.collection?.doing && (
							<span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
								<Users className="h-2.5 w-2.5" />
								{item.collection.doing.toLocaleString()}
							</span>
						)}
					</div>
				</div>
			</button>
		</div>
	);
}

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

	const handleAnimeClick = useCallback(
		(item: BangumiCalendarItem) => {
			navigate(`/subject/${item.id}`, {
				viewTransition: true,
				state: {
					name: item.name_cn || item.name,
					imageUrl: item.images?.large,
				},
			});
		},
		[navigate],
	);

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

import { Calendar, Star, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
	BangumiCalendarDay,
	BangumiCalendarItem,
} from "@/domain/bangumi/BangumiSchemas";
import { useAppContext } from "../context/AppContext";
import { LazyImage } from "./LazyImage";
import { Button } from "./ui/button";

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function getTodayWeekdayId(): number {
	const jsDay = new Date().getDay();
	return jsDay === 0 ? 7 : jsDay;
}

interface WeeklyCalendarProps {
	calendar: BangumiCalendarDay[];
	onAnimeClick: (item: BangumiCalendarItem) => void;
}

export function WeeklyCalendar({
	calendar,
	onAnimeClick,
}: WeeklyCalendarProps) {
	const { calendarActiveDay, setCalendarActiveDay } = useAppContext();
	const todayId = useMemo(() => getTodayWeekdayId(), []);

	const activeDay = calendarActiveDay ?? todayId;

	const setActiveDay = (dayId: number) => {
		setCalendarActiveDay(dayId);
	};

	// 提前构建的 Map，避免在标签页切换时重复执行 O(N) 搜索
	const calendarMap = useMemo(() => {
		const map = new Map<number, BangumiCalendarItem[]>();
		for (const day of calendar) {
			map.set(day.weekday.id, day.items);
		}
		return map;
	}, [calendar]);

	const currentItems = useMemo(() => {
		return calendarMap.get(activeDay) ?? [];
	}, [calendarMap, activeDay]);

	const [isSticky, setIsSticky] = useState(false);
	const sentinelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (typeof IntersectionObserver === "undefined") {
			return;
		}
		const sentinel = sentinelRef.current;
		if (!sentinel) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				setIsSticky(!entry.isIntersecting);
			},
			{
				threshold: [0],
				rootMargin: "-1px 0px 0px 0px",
			},
		);

		observer.observe(sentinel);
		return () => {
			observer.unobserve(sentinel);
		};
	}, []);

	return (
		<section className="w-full relative">
			<div
				ref={sentinelRef}
				className="absolute -top-px left-0 right-0 h-0 pointer-events-none"
			/>
			{/* Weekday Tabs */}
			<div
				className="sticky top-0 z-10 bg-background/85 backdrop-blur-md pb-2 -mx-4 px-4"
				style={{
					paddingTop: isSticky
						? "calc(env(safe-area-inset-top, 0px) + 0.5rem)"
						: "0.5rem",
				}}
			>
				<div className="flex gap-1 p-1 bg-card/30 border border-white/5 rounded-xl">
					{WEEKDAY_LABELS.map((label, index) => {
						const dayId = index + 1;
						const isActive = dayId === activeDay;
						const isToday = dayId === todayId;

						return (
							<Button
								key={dayId}
								variant={isActive ? "default" : "ghost"}
								size="sm"
								className={`flex-1 text-xs font-medium relative ${
									isActive
										? "bg-primary text-primary-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground hover:bg-white/5"
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
				className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
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
		<div className="group flex flex-col bg-card/40 border border-white/5 rounded-lg overflow-hidden hover:border-primary/30 hover:bg-card/60 transition-all duration-200 text-left relative">
			<button
				type="button"
				onClick={onClick}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						onClick();
					}
				}}
				className="flex flex-col flex-1 w-full text-left"
				title={`详情: ${displayName}`}
			>
				{/* Cover Image */}
				{item.images?.large ? (
					<div className="aspect-3/4 w-full overflow-hidden bg-black/20">
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
						<Calendar className="h-8 w-8 text-primary/30" />
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

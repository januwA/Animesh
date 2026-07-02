import { Calendar, Star, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type {
	BangumiCalendarDay,
	BangumiCalendarItem,
} from "@/domain/bangumi/BangumiSchemas";

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function getTodayWeekdayId(): number {
	const jsDay = new Date().getDay();
	return jsDay === 0 ? 7 : jsDay;
}

interface WeeklyCalendarProps {
	calendar: BangumiCalendarDay[];
	onAnimeClick: (subjectId: number) => void;
}

export function WeeklyCalendar({
	calendar,
	onAnimeClick,
}: WeeklyCalendarProps) {
	const todayId = useMemo(() => getTodayWeekdayId(), []);
	const [activeDay, setActiveDay] = useState(todayId);

	const currentDayData = calendar.find((d) => d.weekday.id === activeDay);
	const sortedItems = useMemo(() => {
		if (!currentDayData) return [];
		return [...currentDayData.items].sort((a, b) => {
			const rankA = a.rank ?? Number.MAX_SAFE_INTEGER;
			const rankB = b.rank ?? Number.MAX_SAFE_INTEGER;
			return rankA - rankB;
		});
	}, [currentDayData]);

	return (
		<section className="w-full space-y-4 mt-2">
			{/* Header */}
			<div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
				<Calendar className="h-4 w-4 text-primary" />
				<span>一周新番</span>
			</div>

			{/* Weekday Tabs */}
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

			{/* Anime Grid */}
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
				{sortedItems.map((item) => (
					<AnimeCard
						key={item.id}
						item={item}
						onClick={() => onAnimeClick(item.id)}
					/>
				))}
			</div>

			{sortedItems.length === 0 && (
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
						<img
							src={item.images.large}
							alt={displayName}
							className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
							loading="lazy"
						/>
					</div>
				) : (
					<div className="aspect-[3/4] w-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
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

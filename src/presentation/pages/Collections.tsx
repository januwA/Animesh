import { Heart, Star, Tv } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import type { FavoriteItem } from "@/domain/collection/CollectionSchemas";
import { LazyImage } from "@/presentation/components/LazyImage";
import { Badge } from "@/presentation/components/ui/badge";
import { Button } from "@/presentation/components/ui/button";

export default function Collections() {
	const { collectionRepository } = useDI();
	const items = useMemo(
		() => collectionRepository.getAll(),
		[collectionRepository],
	);
	const navigate = useNavigate();

	return (
		<div className="w-full space-y-4 animate-in fade-in duration-300">
			<div className="flex items-center gap-2">
				<Heart className="h-5 w-5 text-red-500 fill-current" />
				<h1 className="text-lg font-bold text-foreground">我的收藏</h1>
				{items.length > 0 && (
					<Badge
						variant="secondary"
						className="text-xs border-border text-muted-foreground"
					>
						{items.length}
					</Badge>
				)}
			</div>

			{items.length > 0 ? (
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
					{items.map((item) => (
						<CollectionCard
							key={item.subjectId}
							item={item}
							onClick={() => {
								navigate(`/subject/${item.subjectId}`, {
									viewTransition: true,
									state: {
										name: item.nameCn || item.name,
										imageUrl: item.imageUrl,
									},
								});
							}}
						/>
					))}
				</div>
			) : (
				<div className="flex flex-col items-center justify-center py-20 space-y-4">
					<Heart className="h-12 w-12 text-muted-foreground/30" />
					<p className="text-sm text-muted-foreground font-medium">
						还没有收藏任何条目
					</p>
					<Button
						variant="outline"
						size="sm"
						onClick={() => navigate("/calendar")}
					>
						去新番日历看看
					</Button>
				</div>
			)}
		</div>
	);
}

interface CollectionCardProps {
	item: FavoriteItem;
	onClick: () => void;
}

function CollectionCard({ item, onClick }: CollectionCardProps) {
	const displayName = item.nameCn || item.name;

	return (
		<div className="group flex flex-col bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-all duration-200 text-left relative">
			<button
				type="button"
				onClick={onClick}
				className="flex flex-col flex-1 w-full text-left"
				title={`详情: ${displayName}`}
			>
				{item.imageUrl ? (
					<div className="aspect-3/4 w-full overflow-hidden bg-muted">
						<LazyImage
							src={item.imageUrl}
							alt={displayName}
							style={
								{
									viewTransitionName: `anime-cover-${item.subjectId}`,
								} as React.CSSProperties
							}
							className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
						/>
					</div>
				) : (
					<div className="aspect-3/4 w-full bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center">
						<Tv className="h-8 w-8 text-primary/30" />
					</div>
				)}

				<div className="p-2 space-y-1 flex-1 flex flex-col w-full">
					<h3 className="text-xs font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
						{displayName}
					</h3>

					{item.rating && (
						<div className="flex items-center gap-1 mt-auto pt-1">
							<span className="flex items-center gap-0.5 text-[10px] text-amber-400">
								<Star className="h-2.5 w-2.5 fill-current" />
								{item.rating.toFixed(1)}
							</span>
						</div>
					)}
				</div>
			</button>
		</div>
	);
}

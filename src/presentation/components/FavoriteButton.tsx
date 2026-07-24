import { Heart } from "lucide-react";
import { useState } from "react";
import { useDI } from "@/di/DIContext";
import { Button } from "./ui/button";

export interface FavoriteButtonSubject {
	subjectId: number;
	name: string;
	nameCn: string;
	imageUrl: string | null;
	rating: number | null;
	platform: string | null;
	date: string | null;
	summary: string | null;
}

interface FavoriteButtonProps {
	subject: FavoriteButtonSubject;
	showLabel?: boolean;
}

export function FavoriteButton({
	subject,
	showLabel = true,
}: FavoriteButtonProps) {
	const { collectionRepository } = useDI();
	const [favorited, setFavorited] = useState(() =>
		collectionRepository.isFavorited(subject.subjectId),
	);

	const handleClick = () => {
		if (favorited) {
			collectionRepository.remove(subject.subjectId);
		} else {
			collectionRepository.add({
				subjectId: subject.subjectId,
				name: subject.name,
				nameCn: subject.nameCn,
				imageUrl: subject.imageUrl,
				rating: subject.rating,
				platform: subject.platform,
				date: subject.date,
				summary: subject.summary,
			});
		}
		setFavorited(!favorited);
	};

	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={handleClick}
			// style-ignore
			className={`gap-1.5 transition-all ${
				favorited
					? "text-red-500 hover:text-red-600 hover:bg-red-500/10"
					: "text-muted-foreground hover:text-foreground"
			}`}
			title={favorited ? "取消收藏" : "添加收藏"}
		>
			<Heart
				className={`h-4 w-4 transition-all ${favorited ? "fill-current" : ""}`}
			/>
			{showLabel && (
				<span className="text-xs">{favorited ? "已收藏" : "收藏"}</span>
			)}
		</Button>
	);
}

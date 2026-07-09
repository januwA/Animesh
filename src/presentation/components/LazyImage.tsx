import type React from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/presentation/lib/utils";

export interface LazyImageProps
	extends React.ImgHTMLAttributes<HTMLImageElement> {
	src: string;
	alt: string;
	placeholder?: React.ReactNode;
	fallback?: React.ReactNode;
	threshold?: number;
	rootMargin?: string;
}

// 用于记录全局已加载的图片，防止同一张图片在组件重新挂载（如标签页切换）时反复展示骨架屏和渐显动画
const loadedSrcCache = new Set<string>();

export function LazyImage({
	src,
	alt,
	className,
	style,
	placeholder,
	fallback,
	threshold = 0.1,
	rootMargin = "200px",
	...props
}: LazyImageProps) {
	const [inView, setInView] = useState(() => loadedSrcCache.has(src));
	const [isLoaded, setIsLoaded] = useState(() => loadedSrcCache.has(src));
	const [isError, setIsError] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// 如果已经缓存或已进入视口，不需要再观察
		if (inView) return;

		const container = containerRef.current;
		/* v8 ignore next */
		if (!container) return;

		if (typeof window === "undefined" || !window.IntersectionObserver) {
			setInView(true);
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setInView(true);
					observer.disconnect();
				}
			},
			{ threshold, rootMargin },
		);

		observer.observe(container);

		return () => {
			observer.disconnect();
		};
	}, [inView, threshold, rootMargin]);

	// 默认的占位/骨架屏
	const defaultPlaceholder = (
		<div className="absolute inset-0 bg-white/5 animate-pulse rounded-lg flex items-center justify-center">
			<div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
		</div>
	);

	// 默认的加载失败占位
	const defaultFallback = (
		<div className="absolute inset-0 bg-white/5 rounded-lg flex flex-col items-center justify-center text-muted-foreground p-2 border border-dashed border-white/10">
			<span className="text-[10px] text-red-400 font-medium">加载失败</span>
		</div>
	);

	return (
		<div
			ref={containerRef}
			className="relative w-full h-full overflow-hidden flex items-center justify-center"
		>
			{!isLoaded && !isError && (placeholder ?? defaultPlaceholder)}
			{isError && (fallback ?? defaultFallback)}

			{inView && !isError && (
				<img
					src={src}
					alt={alt}
					onLoad={() => {
						setIsLoaded(true);
						loadedSrcCache.add(src);
					}}
					onError={() => setIsError(true)}
					className={cn(
						"h-full w-full object-cover transition-opacity duration-300",
						isLoaded ? "opacity-100" : "opacity-0 absolute inset-0",
						className,
					)}
					style={style}
					{...props}
				/>
			)}
		</div>
	);
}

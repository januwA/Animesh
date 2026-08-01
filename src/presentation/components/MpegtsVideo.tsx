import mpegts from "mpegts.js";
import { useEffect, useRef } from "react";

interface MpegtsVideoProps {
	src: string;
	autoplay?: boolean;
	onError?: (code?: number) => void;
}

export function MpegtsVideo({ src, autoplay, onError }: MpegtsVideoProps) {
	const videoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		const video = videoRef.current;
		if (!video || !mpegts.isSupported()) {
			onError?.();
			return;
		}

		const player = mpegts.createPlayer(
			{
				type: "flv",
				isLive: true,
				url: src,
			},
			{
				enableStashBuffer: true,
				lazyLoad: false,
			},
		);

		const handlePlayerError = () => {
			const code = video.error?.code;
			onError?.(code);
		};

		player.on(mpegts.Events.ERROR, handlePlayerError);
		player.attachMediaElement(video);
		player.load();
		if (autoplay) {
			Promise.resolve(player.play()).catch(() => {});
		}

		return () => {
			player.off(mpegts.Events.ERROR, handlePlayerError);
			player.destroy();
		};
	}, [src, autoplay, onError]);

	return (
		// biome-ignore lint/a11y/useMediaCaption: FLV 直播流不支持字幕轨
		<video
			ref={videoRef}
			controls
			playsInline
			// style-ignore: 视频播放元素在加载与留白时需要纯黑底色，与主题无关
			className="h-full w-full bg-black object-contain"
		/>
	);
}

import { createContext, use, useEffect, useState } from "react";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { formatError } from "@/utils";

interface TorrentStatusContextType {
	torrents: TorrentStatusInfo[];
	isLoading: boolean;
}

const TorrentStatusContext = createContext<
	TorrentStatusContextType | undefined
>(undefined);

export function TorrentStatusProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { subscribeTorrentsUseCase } = useDI();
	const [torrents, setTorrents] = useState<TorrentStatusInfo[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let unsubscribe: (() => void) | null = null;
		let isCleanedUp = false;

		subscribeTorrentsUseCase
			.execute((list) => {
				setTorrents(list);
				setIsLoading(false);
			})
			.then((unsub) => {
				if (isCleanedUp) {
					unsub();
				} else {
					unsubscribe = unsub;
				}
			})
			.catch((err: unknown) => {
				toast.error(`获取下载列表失败: ${formatError(err)}`);
				setIsLoading(false);
			});

		return () => {
			isCleanedUp = true;
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [subscribeTorrentsUseCase]);

	return (
		<TorrentStatusContext value={{ torrents, isLoading }}>
			{children}
		</TorrentStatusContext>
	);
}

export function useTorrentStatus(): TorrentStatusContextType {
	const context = use(TorrentStatusContext);
	if (context === undefined) {
		return { torrents: [], isLoading: true };
	}
	return context;
}

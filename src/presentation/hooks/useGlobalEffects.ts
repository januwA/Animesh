import { useTheme } from "next-themes";
import { useEffect } from "react";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";

export function useGlobalEffects() {
	const {
		notificationRepository,
		notifyDownloadCompletionUseCase,
		subscribeTorrentsUseCase,
		autoUpdateTrackersUseCase,
		setThemeUseCase,
	} = useDI();
	const { resolvedTheme } = useTheme();

	// 同步主题到 Tauri 原生窗口标题栏
	useEffect(() => {
		const syncTheme = async () => {
			if (resolvedTheme === "dark" || resolvedTheme === "light") {
				try {
					await setThemeUseCase.execute(resolvedTheme);
				} catch {}
			}
		};
		syncTheme();
	}, [resolvedTheme, setThemeUseCase]);

	// 请求系统通知权限
	useEffect(() => {
		notificationRepository.requestPermission();
	}, [notificationRepository]);

	// 下载完成监听
	useEffect(() => {
		let unsubscribe: (() => void) | null = null;
		let isCleanedUp = false;

		const initSubscription = async () => {
			try {
				const unsub = await subscribeTorrentsUseCase.execute(async (list) => {
					try {
						await notifyDownloadCompletionUseCase.execute(list);
					} catch {}
				});
				if (isCleanedUp) {
					unsub();
				} else {
					unsubscribe = unsub;
				}
			} catch {}
		};

		initSubscription();

		return () => {
			isCleanedUp = true;
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [subscribeTorrentsUseCase, notifyDownloadCompletionUseCase]);

	// 自动更新 Tracker
	useEffect(() => {
		const updateTrackers = async () => {
			try {
				const count = await autoUpdateTrackersUseCase.execute();
				if (count !== null && count > 0) {
					toast.success(`自动更新 Tracker 列表成功，已同步 ${count} 个服务器`);
				}
			} catch {}
		};
		updateTrackers();
	}, [autoUpdateTrackersUseCase]);
}

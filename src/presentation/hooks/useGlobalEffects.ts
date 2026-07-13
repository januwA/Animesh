import { useTheme } from "next-themes";
import { useEffect } from "react";
import { useDI } from "@/di/DIContext";
import { useAppContext } from "../context/AppContext";

export function useGlobalEffects() {
	const { toasts, removeToast, showToast } = useAppContext();
	const {
		notificationRepository,
		notifyDownloadCompletionUseCase,
		subscribeTorrentsUseCase,
		autoUpdateTrackersUseCase,
	} = useDI();
	const { resolvedTheme } = useTheme();

	// 同步主题到 Tauri 原生窗口标题栏
	useEffect(() => {
		const isTauri =
			import.meta.env.MODE !== "web" &&
			typeof window !== "undefined" &&
			"__TAURI_INTERNALS__" in window;

		if (!isTauri) return;

		import("@tauri-apps/api/window")
			.then(({ getCurrentWindow }) => {
				const appWindow = getCurrentWindow();
				if (resolvedTheme === "dark" || resolvedTheme === "light") {
					appWindow.setTheme(resolvedTheme).catch(() => {});
				}
			})
			.catch(() => {});
	}, [resolvedTheme]);

	// 请求系统通知权限
	useEffect(() => {
		notificationRepository.requestPermission();
	}, [notificationRepository]);

	// 下载完成监听
	useEffect(() => {
		let unsubscribe: (() => void) | null = null;
		let isCleanedUp = false;

		subscribeTorrentsUseCase
			.execute(async (list) => {
				try {
					await notifyDownloadCompletionUseCase.execute(list);
				} catch {}
			})
			.then((unsub) => {
				if (isCleanedUp) {
					unsub();
				} else {
					unsubscribe = unsub;
				}
			})
			.catch(() => {});

		return () => {
			isCleanedUp = true;
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [subscribeTorrentsUseCase, notifyDownloadCompletionUseCase]);

	// 自动更新 Tracker
	useEffect(() => {
		autoUpdateTrackersUseCase
			.execute()
			.then((count) => {
				if (count !== null && count > 0) {
					showToast(
						`自动更新 Tracker 列表成功，已同步 ${count} 个服务器`,
						"success",
					);
				}
			})
			.catch(() => {});
	}, [autoUpdateTrackersUseCase, showToast]);

	return { toasts, removeToast };
}

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

	// 请求系统通知权限
	useEffect(() => {
		notificationRepository.requestPermission();
	}, [notificationRepository]);

	// 下载完成监听
	useEffect(() => {
		let unsubscribe: (() => void) | null = null;

		subscribeTorrentsUseCase
			.execute(async (list) => {
				try {
					await notifyDownloadCompletionUseCase.execute(list);
				} catch {}
			})
			.then((unsub) => {
				unsubscribe = unsub;
			})
			.catch(() => {});

		return () => {
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
					showToast(`自动更新 Tracker 列表成功，已同步 ${count} 个服务器`);
				}
			})
			.catch(() => {});
	}, [autoUpdateTrackersUseCase, showToast]);

	return { toasts, removeToast };
}

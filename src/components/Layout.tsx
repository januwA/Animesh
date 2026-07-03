import { useEffect } from "react";
import { Outlet, ScrollRestoration } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useDI } from "../di/DIContext";
import { AppHeader, ToastContainer } from "./AppComponents";

export default function Layout() {
	const { toasts, removeToast } = useAppContext();
	const {
		notificationRepository,
		notifyDownloadCompletionUseCase,
		subscribeTorrentsUseCase,
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

	return (
		<main className="container max-w-4xl mx-auto px-4 py-10 flex flex-col min-h-screen">
			{/* 页面头部 */}
			<AppHeader />

			{/* 路由视图 */}
			<Outlet />

			{/* 提示消息 */}
			<ToastContainer toasts={toasts} onClose={removeToast} />

			{/* 滚动位置恢复 */}
			<ScrollRestoration />
		</main>
	);
}

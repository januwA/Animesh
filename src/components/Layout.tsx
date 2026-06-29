import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useDI } from "../di/DIContext";
import { AppHeader, ToastContainer } from "./AppComponents";

export default function Layout() {
	const { toasts, removeToast } = useAppContext();
	const { notificationRepository, notifyDownloadCompletionUseCase } = useDI();

	// 请求系统通知权限
	useEffect(() => {
		const isTauri =
			typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
		if (!isTauri) return;

		notificationRepository.requestPermission();
	}, [notificationRepository]);

	// 下载完成监听轮询
	useEffect(() => {
		const isTauri =
			typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
		if (!isTauri) return;

		const checkDownloads = async () => {
			try {
				await notifyDownloadCompletionUseCase.execute();
			} catch {}
		};

		checkDownloads();
		const interval = setInterval(checkDownloads, 3000);
		return () => clearInterval(interval);
	}, [notifyDownloadCompletionUseCase]);

	return (
		<main className="container max-w-4xl mx-auto px-4 py-10 flex flex-col min-h-screen">
			{/* 页面头部 */}
			<AppHeader />

			{/* 路由视图 */}
			<Outlet />

			{/* 提示消息 */}
			<ToastContainer toasts={toasts} onClose={removeToast} />
		</main>
	);
}

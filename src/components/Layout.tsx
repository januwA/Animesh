import {
	isPermissionGranted,
	requestPermission,
	sendNotification,
} from "@tauri-apps/plugin-notification";
import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useDI } from "../di/DIContext";
import { AppHeader, ToastContainer } from "./AppComponents";

export default function Layout() {
	const { toasts, removeToast } = useAppContext();
	const { torrentRepository } = useDI();
	const notifiedHashesRef = useRef<Set<string>>(new Set());

	// 请求系统通知权限
	useEffect(() => {
		const isTauri =
			typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
		if (!isTauri) return;

		const requestPermissionIfNeeded = async () => {
			try {
				const granted = await isPermissionGranted();
				if (!granted) {
					await requestPermission();
				}
			} catch (e) {
				console.error("Failed to request notification permission:", e);
			}
		};
		requestPermissionIfNeeded();
	}, []);

	// 下载完成监听轮询
	useEffect(() => {
		const isTauri =
			typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
		if (!isTauri) return;

		let isFirstRun = true;

		const checkDownloads = async () => {
			try {
				const list = await torrentRepository.listTorrents();
				if (Array.isArray(list)) {
					for (const torrent of list) {
						if (torrent.finished) {
							if (isFirstRun) {
								// 首次加载时将已完成的种子记录下来，避免重复通知旧数据
								notifiedHashesRef.current.add(torrent.info_hash);
							} else if (!notifiedHashesRef.current.has(torrent.info_hash)) {
								notifiedHashesRef.current.add(torrent.info_hash);
								// 触发原生系统通知
								const granted = await isPermissionGranted();
								if (granted) {
									sendNotification({
										title: "下载完成",
										body: `动漫 《${torrent.name || "未命名种子"}》 已下载完成！`,
									});
								}
							}
						} else {
							// 如果种子被重启下载或删除，清除已通知记录
							if (notifiedHashesRef.current.has(torrent.info_hash)) {
								notifiedHashesRef.current.delete(torrent.info_hash);
							}
						}
					}
				}
				isFirstRun = false;
			} catch (err) {
				console.error("Error in background torrent check:", err);
			}
		};

		checkDownloads();
		const interval = setInterval(checkDownloads, 3000);
		return () => clearInterval(interval);
	}, [torrentRepository]);

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

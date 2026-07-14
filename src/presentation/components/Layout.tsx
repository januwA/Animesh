import { Suspense } from "react";
import { Outlet, ScrollRestoration } from "react-router-dom";
import { useGlobalEffects } from "../hooks/useGlobalEffects";
import { AppHeader, PageLoader, ToastContainer } from "./AppComponents";

export default function Layout() {
	const { toasts, removeToast } = useGlobalEffects();

	return (
		<main
			className="container max-w-6xl mx-auto px-4 pb-24 md:py-10 flex flex-col min-h-screen"
			style={{
				paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)",
			}}
		>
			{/* 页面头部 */}
			<AppHeader />

			{/* 路由视图 */}
			<Suspense fallback={<PageLoader />}>
				<Outlet />
			</Suspense>

			{/* 提示消息 */}
			<ToastContainer toasts={toasts} onClose={removeToast} />

			{/* 滚动位置恢复 */}
			<ScrollRestoration />
		</main>
	);
}

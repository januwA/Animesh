import { Outlet } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { AppHeader, ToastContainer } from "./AppComponents";

export default function Layout() {
	const { toasts, removeToast } = useAppContext();

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

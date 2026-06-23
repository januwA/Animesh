import {
	createHashRouter,
	createMemoryRouter,
	RouterProvider,
} from "react-router-dom";
import Layout from "./components/Layout";
import { AppContextProvider } from "./context/AppContext";
import Downloads from "./pages/Downloads";
import Home from "./pages/Home";
import Player from "./pages/Player";
import Settings from "./pages/Settings";
import TorrentDetail from "./pages/TorrentDetail";
import "./App.css";

const routes = [
	{
		path: "/",
		element: <Layout />,
		children: [
			{
				path: "",
				element: <Home />,
			},
			{
				path: "torrent",
				element: <TorrentDetail />,
			},
			{
				path: "play/:infoHash/:fileId",
				element: <Player />,
			},
			{
				path: "downloads",
				element: <Downloads />,
			},
			{
				path: "settings",
				element: <Settings />,
			},
		],
	},
];

const isTest =
	typeof globalThis !== "undefined" &&
	// biome-ignore lint/suspicious/noExplicitAny: dynamic env check
	(globalThis as any).process?.env?.NODE_ENV === "test";

export default function App() {
	// In test environment, use createMemoryRouter to ensure 100% test isolation.
	// In production, use createHashRouter.
	const router =
		// biome-ignore lint/suspicious/noExplicitAny: dynamic test flag check
		isTest && !(globalThis as any).__disable_memory_router_for_test__
			? createMemoryRouter(routes, {
					initialEntries: [window.location.hash.replace(/^#/, "") || "/"],
				})
			: createHashRouter(routes);

	return (
		<AppContextProvider>
			<RouterProvider router={router} />
		</AppContextProvider>
	);
}

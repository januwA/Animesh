import type { createHashRouter } from "react-router-dom";
import { RouterProvider } from "react-router-dom";
import Layout from "./components/Layout";
import { AppContextProvider } from "./context/AppContext";
import { createDefaultDIContainer, DIProvider } from "./di/DIContext";
import Calendar from "./pages/Calendar";
import Downloads from "./pages/Downloads";
import Home from "./pages/Home";
import Player from "./pages/Player";
import Settings from "./pages/Settings";
import TorrentDetail from "./pages/TorrentDetail";
import "./App.css";

export const routes = [
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
				path: "calendar",
				element: <Calendar />,
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

const defaultContainer = createDefaultDIContainer();

interface AppProps {
	router: ReturnType<typeof createHashRouter>;
	// biome-ignore lint/suspicious/noExplicitAny: allow dynamic container injection
	diContainer?: any;
}

export default function App({ router, diContainer }: AppProps) {
	const container = diContainer || defaultContainer;

	return (
		<DIProvider value={container}>
			<AppContextProvider>
				<RouterProvider router={router} />
			</AppContextProvider>
		</DIProvider>
	);
}

import {
	createHashRouter,
	createMemoryRouter,
	RouterProvider,
} from "react-router-dom";
import Layout from "./components/Layout";
import { AppContextProvider } from "./context/AppContext";
import Home from "./pages/Home";
import Player from "./pages/Player";
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
		],
	},
];

const isTest =
	typeof process !== "undefined" && process.env.NODE_ENV === "test";

export default function App() {
	// In test environment, use createMemoryRouter to ensure 100% test isolation.
	// In production, use createHashRouter.
	const router = isTest
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

import type { RouteObject } from "react-router-dom";
import Layout from "./components/Layout";
import Calendar from "./pages/Calendar";
import Downloads from "./pages/Downloads";
import Home from "./pages/Home";
import Player from "./pages/Player";
import Settings from "./pages/Settings";
import SubjectDetail from "./pages/SubjectDetail";
import TorrentDetail from "./pages/TorrentDetail";

export const routes: RouteObject[] = [
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
				path: "subject/:subjectId",
				element: <SubjectDetail />,
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

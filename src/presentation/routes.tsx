import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import { MainLayout, NavBarLayout } from "./components/Layout";
import Home from "./pages/Home";

const Calendar = lazy(() => import("./pages/Calendar"));
const Collections = lazy(() => import("./pages/Collections"));
const Downloads = lazy(() => import("./pages/Downloads"));
const Iptv = lazy(() => import("./pages/Iptv"));
const LivePlayer = lazy(() => import("./pages/LivePlayer"));
const Player = lazy(() => import("./pages/Player"));
const Settings = lazy(() => import("./pages/Settings"));
const SubjectDetail = lazy(() => import("./pages/SubjectDetail"));
const TorrentDetail = lazy(() => import("./pages/TorrentDetail"));

export const routes: RouteObject[] = [
	{
		element: <MainLayout />,
		children: [
			{
				path: "torrent",
				element: <TorrentDetail />,
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
				element: <NavBarLayout />,
				children: [
					{
						path: "",
						element: <Home />,
					},
					{
						path: "calendar",
						element: <Calendar />,
					},
					{
						path: "collections",
						element: <Collections />,
					},
					{
						path: "downloads",
						element: <Downloads />,
					},
					{
						path: "live",
						element: <Iptv />,
					},
					{
						path: "live/play",
						element: <LivePlayer />,
					},
					{
						path: "settings",
						element: <Settings />,
					},
				],
			},
		],
	},
];

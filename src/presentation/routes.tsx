import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import Layout from "./components/Layout";
import SimpleLayout from "./components/SimpleLayout";
import Home from "./pages/Home";

const Calendar = lazy(() => import("./pages/Calendar"));
const Collections = lazy(() => import("./pages/Collections"));
const Downloads = lazy(() => import("./pages/Downloads"));
const Player = lazy(() => import("./pages/Player"));
const Settings = lazy(() => import("./pages/Settings"));
const SubjectDetail = lazy(() => import("./pages/SubjectDetail"));
const TorrentDetail = lazy(() => import("./pages/TorrentDetail"));

export const routes: RouteObject[] = [
	{
		path: "/",
		children: [
			{
				element: <Layout />,
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
						path: "settings",
						element: <Settings />,
					},
				],
			},
			{
				element: <SimpleLayout />,
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
				],
			},
		],
	},
];

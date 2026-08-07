import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import { MainLayout, NavBarLayout } from "./components/Layout";
import TorrentSearch from "./pages/TorrentSearch";

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
        path: "live/play",
        element: <LivePlayer />,
      },
      {
        element: <NavBarLayout />,
        children: [
          {
            path: "",
            element: <TorrentSearch />,
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
            path: "settings",
            element: <Settings />,
          },
        ],
      },
    ],
  },
];

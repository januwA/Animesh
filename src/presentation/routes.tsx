import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import { DetailLayout, MainLayout, NavBarLayout } from "./layout/Layout";
import { SidebarLayout } from "./layout/SidebarLayout";
import TorrentSearch from "./pages/TorrentSearch";

const AiSubtitleTranslation = lazy(
  () => import("./pages/AiSubtitleTranslation"),
);
const Calendar = lazy(() => import("./pages/Calendar"));
const Collections = lazy(() => import("./pages/Collections"));
const Downloads = lazy(() => import("./pages/Downloads"));
const NextSeasonAnime = lazy(() => import("./pages/NextSeasonAnime"));
const Iptv = lazy(() => import("./pages/Iptv"));
const LivePlayer = lazy(() => import("./pages/LivePlayer"));
const Player = lazy(() => import("./pages/Player"));
const Settings = lazy(() => import("./pages/Settings"));
const SubjectDetail = lazy(() => import("./pages/SubjectDetail"));
const SubjectSearch = lazy(() => import("./pages/SubjectSearch"));
const TorrentDetail = lazy(() => import("./pages/TorrentDetail"));

export const routes: RouteObject[] = [
  {
    element: <MainLayout />,
    children: [
      {
        element: <DetailLayout />,
        children: [
          {
            path: "torrent",
            element: <TorrentDetail />,
          },
          {
            path: "subject/:subjectId",
            element: <SubjectDetail platform="bangumi" />,
          },
          {
            path: "anilist/subject/:subjectId",
            element: <SubjectDetail platform="anilist" />,
          },
          {
            path: "play/:infoHash/:fileId",
            element: <Player />,
          },
          {
            path: "play/:infoHash/:fileId/ai-subtitle",
            element: <AiSubtitleTranslation />,
          },
          {
            path: "live/play",
            element: <LivePlayer />,
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
      {
        element: <NavBarLayout />,
        children: [
          {
            path: "",
            element: <TorrentSearch />,
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
            element: <SidebarLayout />,
            children: [
              {
                path: "bangumi",
                children: [
                  {
                    path: "",
                    index: true,
                    element: <Calendar platform="bangumi" />,
                  },
                  {
                    path: "search",
                    element: <SubjectSearch platform="bangumi" />,
                  },
                  {
                    path: "next-season",
                    element: <NextSeasonAnime platform="bangumi" />,
                  },
                ],
              },
              {
                path: "anilist",
                children: [
                  {
                    path: "",
                    index: true,
                    element: <Calendar platform="anilist" />,
                  },
                  {
                    path: "search",
                    element: <SubjectSearch platform="anilist" />,
                  },
                  {
                    path: "next-season",
                    element: <NextSeasonAnime platform="anilist" />,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

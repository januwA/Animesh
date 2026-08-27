import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import { DetailLayout, MainLayout, NavBarLayout } from "./layout/Layout";
import { SidebarLayout } from "./layout/SidebarLayout";
import TorrentSearch from "./pages/TorrentSearch";

const AiSubtitleTranslation = lazy(
  () => import("./pages/AiSubtitleTranslation"),
);
const AnilistCalendar = lazy(() => import("./pages/AnilistCalendar"));
const AnilistNextSeason = lazy(() => import("./pages/AnilistNextSeason"));
const AnilistSearch = lazy(() => import("./pages/AnilistSearch"));
const AnilistSubjectDetail = lazy(() => import("./pages/AnilistSubjectDetail"));
const BangumiSearch = lazy(() => import("./pages/BangumiSearch"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Collections = lazy(() => import("./pages/Collections"));
const Downloads = lazy(() => import("./pages/Downloads"));
const NextSeasonAnime = lazy(() => import("./pages/NextSeasonAnime"));
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
        element: <DetailLayout />,
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
            path: "anilist/subject/:subjectId",
            element: <AnilistSubjectDetail />,
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
                  { path: "", index: true, element: <Calendar /> },
                  { path: "search", element: <BangumiSearch /> },
                  { path: "next-season", element: <NextSeasonAnime /> },
                ],
              },
              {
                path: "anilist",
                children: [
                  { path: "", index: true, element: <AnilistCalendar /> },
                  { path: "search", element: <AnilistSearch /> },
                  { path: "next-season", element: <AnilistNextSeason /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

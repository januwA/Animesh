import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { DetailLayout, MainLayout, NavBarLayout } from "./layout/Layout";
import { SidebarLayout } from "./layout/SidebarLayout";
import TorrentSearch from "./pages/TorrentSearch";

const AiSubtitleTranslation = lazy(
  () => import("./pages/AiSubtitleTranslation"),
);
const SubjectCalendar = lazy(() => import("./pages/SubjectCalendar"));
const Collections = lazy(() => import("./pages/Collections"));
const Downloads = lazy(() => import("./pages/Downloads"));
const NextSeasonAnime = lazy(() => import("./pages/NextSeasonAnime"));
const Iptv = lazy(() => import("./pages/Iptv"));
const LivePlayer = lazy(() => import("./pages/LivePlayer"));
const Player = lazy(() => import("./pages/Player"));
const SubjectDetail = lazy(() => import("./pages/SubjectDetail"));
const SubjectSearch = lazy(() => import("./pages/SubjectSearch"));
const TorrentDetail = lazy(() => import("./pages/TorrentDetail"));

const SettingsSidebarLayout = lazy(
  () => import("./pages/Settings/SettingsSidebarLayout"),
);
const StoragePage = lazy(() => import("./pages/Settings/StoragePage"));
const NetworkPage = lazy(() => import("./pages/Settings/NetworkPage"));
const AiModelsPage = lazy(() => import("./pages/Settings/AiModelsPage"));
const TranslationPage = lazy(() => import("./pages/Settings/TranslationPage"));
const CachePage = lazy(() => import("./pages/Settings/CachePage"));
const AppearancePage = lazy(() => import("./pages/Settings/AppearancePage"));
const AboutPage = lazy(() => import("./pages/Settings/AboutPage"));

export const routes: RouteObject[] = [
  {
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/torrent_search" replace />,
      },
      {
        element: <DetailLayout />,
        children: [
          {
            path: "torrent",
            element: <TorrentDetail />,
          },
          {
            path: "bangumi/subject/:subjectId",
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
        ],
      },

      {
        element: <NavBarLayout />,
        children: [
          {
            path: "torrent_search",
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
                    element: <SubjectCalendar platform="bangumi" />,
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
                    element: <SubjectCalendar platform="anilist" />,
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
          {
            path: "settings",
            element: <SettingsSidebarLayout />,
            children: [
              { index: true, element: <Navigate to="appearance" replace /> },
              { path: "storage", element: <StoragePage /> },
              { path: "network", element: <NetworkPage /> },
              { path: "ai-models", element: <AiModelsPage /> },
              { path: "translation", element: <TranslationPage /> },
              { path: "cache", element: <CachePage /> },
              { path: "appearance", element: <AppearancePage /> },
              { path: "about", element: <AboutPage /> },
            ],
          },
          {
            path: "live",
            element: <Iptv />,
          },
        ],
      },
    ],
  },
];

import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import { MainLayout, NavBarLayout } from "./components/Layout";
import TorrentSearch from "./pages/TorrentSearch";

const AiSubtitleTranslation = lazy(
  () => import("./pages/AiSubtitleTranslation"),
);
const BangumiSearch = lazy(() => import("./pages/BangumiSearch"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Collections = lazy(() => import("./pages/Collections"));
const Downloads = lazy(() => import("./pages/Downloads"));
const Iptv = lazy(() => import("./pages/Iptv"));
const LivePlayer = lazy(() => import("./pages/LivePlayer"));
const Player = lazy(() => import("./pages/Player"));
const Settings = lazy(() => import("./pages/Settings"));
const SubjectDetail = lazy(() => import("./pages/SubjectDetail"));
const TorrentDetail = lazy(() => import("./pages/TorrentDetail"));

/** 应用外壳组合根：从 DI 容器取全局依赖并注入布局 */
function MainLayoutRoute() {
  const {
    requestNotificationPermissionUseCase,
    notifyDownloadCompletionUseCase,
    setThemeUseCase,
  } = useDI();

  return (
    <MainLayout
      globalEffectsDeps={{
        requestNotificationPermissionUseCase,
        notifyDownloadCompletionUseCase,
        setThemeUseCase,
      }}
    />
  );
}

export const routes: RouteObject[] = [
  {
    element: <MainLayoutRoute />,
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
        path: "play/:infoHash/:fileId/ai-subtitle",
        element: <AiSubtitleTranslation />,
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
            path: "search",
            element: <BangumiSearch />,
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

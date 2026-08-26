import { Suspense } from "react";
import { Outlet, ScrollRestoration } from "react-router-dom";
import { useGlobalEffects } from "../hooks/useGlobalEffects";
import { useBackgroundWallpaperStore } from "../store/useBackgroundWallpaperStore";
import { PageLoader } from "./AppComponents";
import { AppNavBar } from "./AppNavBar";
import { BackButton } from "./BackButton";
import { BackgroundWallpaper } from "./BackgroundWallpaper";
import { Card, CardContent } from "./ui/card";

export function DetailLayout() {
  return (
    <>
      <Card className="ani-card mb-4">
        <CardContent>
          <BackButton />
        </CardContent>
      </Card>
      <Outlet />
    </>
  );
}

export function NavBarLayout() {
  return (
    <>
      <AppNavBar />
      <Outlet />
    </>
  );
}

export function MainLayout() {
  useGlobalEffects();

  const showWallpaper = useBackgroundWallpaperStore((s) => s.showWallpaper);

  return (
    <>
      {/* v8 ignore start */}
      {showWallpaper && <BackgroundWallpaper />}
      {/* v8 ignore stop */}
      <main
        className="container relative z-10 max-w-7xl mx-auto px-4 pb-24 md:pb-24 md:pt-10 flex flex-col min-h-screen"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)",
        }}
      >
        {/* 路由视图 */}
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>

        {/* 滚动位置恢复 */}
        <ScrollRestoration />
      </main>
    </>
  );
}

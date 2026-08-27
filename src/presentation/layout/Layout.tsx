import { Suspense } from "react";
import { Outlet, ScrollRestoration } from "react-router-dom";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { PageLoader } from "../components/AppComponents";
import { BackButton } from "../components/BackButton";
import { BackgroundWallpaper } from "../components/BackgroundWallpaper";
import { useGlobalEffects } from "../hooks/useGlobalEffects";
import { useBackgroundWallpaperStore } from "../store/useBackgroundWallpaperStore";
import { AppNavBar } from "./AppNavBar";

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

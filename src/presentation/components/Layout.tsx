import { Suspense } from "react";
import { Outlet, ScrollRestoration } from "react-router-dom";
import type { UseGlobalEffectsDeps } from "../hooks/useGlobalEffects";
import { useGlobalEffects } from "../hooks/useGlobalEffects";
import { AppNavBar, PageLoader } from "./AppComponents";

export function NavBarLayout() {
  return (
    <>
      <AppNavBar />
      <Outlet />
    </>
  );
}

interface MainLayoutProps {
  globalEffectsDeps: UseGlobalEffectsDeps;
}

export function MainLayout({ globalEffectsDeps }: MainLayoutProps) {
  useGlobalEffects(globalEffectsDeps);

  return (
    <main
      className="container max-w-7xl mx-auto px-4 pb-24 md:pb-24 md:pt-10 flex flex-col min-h-screen"
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
  );
}

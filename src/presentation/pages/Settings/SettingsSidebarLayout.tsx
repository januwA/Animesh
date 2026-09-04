import {
  Bot,
  Globe,
  HardDrive,
  Info,
  Languages,
  Palette,
  Trash2,
} from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useDI } from "@/di/DIContext";
import { PageLoader } from "@/presentation/components/AppComponents";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/presentation/components/ui/sidebar";
import { useQuery } from "@/presentation/hooks/useQuery";
import {
  SettingsLoaderContext,
  type SettingsLoaderContextType,
  useSettingsLoader,
} from "./SettingsContext";

interface SidebarItem {
  title: string;
  url: string;
  icon: React.ComponentType;
}

export default function SettingsSidebarLayout() {
  const { getCurrentVersionUseCase } = useDI();
  const isTauri = import.meta.env.MODE !== "web";
  const isMobile = ["android", "ios"].includes(
    import.meta.env.TAURI_ENV_PLATFORM,
  );
  const [currentVersion, setCurrentVersion] = useState("");

  const { loading } = useQuery(
    () => getCurrentVersionUseCase.execute(),
    [getCurrentVersionUseCase],
    {
      enabled: isTauri,
      onSuccess: (v) => setCurrentVersion(v),
    },
  );

  const contextValue: SettingsLoaderContextType = useMemo(
    () => ({ isTauri, isMobile, loading, currentVersion }),
    [loading, currentVersion],
  );

  return (
    <SettingsLoaderContext value={contextValue}>
      <SidebarLayoutInner />
    </SettingsLoaderContext>
  );
}

function SidebarLayoutInner() {
  const { isTauri } = useSettingsLoader();
  const location = useLocation();

  const sidebarItems = useMemo(() => {
    const items: SidebarItem[] = [];
    if (isTauri) {
      items.push({ title: "存储", url: "/settings/storage", icon: HardDrive });
      items.push({ title: "网络", url: "/settings/network", icon: Globe });
    }
    items.push({ title: "AI 模型", url: "/settings/ai-models", icon: Bot });
    items.push({
      title: "翻译",
      url: "/settings/translation",
      icon: Languages,
    });
    items.push({ title: "缓存", url: "/settings/cache", icon: Trash2 });
    items.push({ title: "外观", url: "/settings/appearance", icon: Palette });
    if (isTauri) {
      items.push({ title: "关于", url: "/settings/about", icon: Info });
    }
    return items;
  }, [isTauri]);

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {sidebarItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.url}
                      tooltip={item.title}
                    >
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
        </header>
        <div className="flex-1 overflow-auto p-4">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

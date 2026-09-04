import { Calendar, CalendarDays, Search } from "lucide-react";
import { Suspense } from "react";
import { Link, Outlet, useLocation, useSearchParams } from "react-router-dom";
import type { AnimePlatform } from "@/domain/anime/AnimeSchemas";
import { AnimePlatformSchema } from "@/domain/anime/AnimeSchemas";
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
import { PageLoader } from "../components/AppComponents";

interface SidebarItem {
  title: string;
  url: string;
  icon: React.ComponentType;
}

function getSidebarItems(platform: AnimePlatform): SidebarItem[] {
  return [
    { title: "新番日历", url: `/anime?platform=${platform}`, icon: Calendar },
    {
      title: "下季新番",
      url: `/anime/next-season?platform=${platform}`,
      icon: CalendarDays,
    },
    {
      title: "搜索动画",
      url: `/anime/search?platform=${platform}`,
      icon: Search,
    },
  ];
}

export function SidebarLayout() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const platformResult = AnimePlatformSchema.safeParse(
    searchParams.get("platform"),
  );
  const platform = platformResult.success ? platformResult.data : "bangumi";
  const sidebarItems = getSidebarItems(platform);
  const currentUrl = location.pathname + location.search;

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
                      isActive={currentUrl === item.url}
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

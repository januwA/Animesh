import { Calendar, CalendarDays, Search } from "lucide-react";
import { Suspense } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
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

function getSidebarItems(pathname: string): SidebarItem[] {
  if (pathname.startsWith("/anilist")) {
    return [
      { title: "新番日历", url: "/anilist", icon: Calendar },
      { title: "下季新番", url: "/anilist/next-season", icon: CalendarDays },
      { title: "搜索动画", url: "/anilist/search", icon: Search },
    ];
  }

  return [
    { title: "新番日历", url: "/bangumi", icon: Calendar },
    { title: "下季新番", url: "/bangumi/next-season", icon: CalendarDays },
    { title: "搜索动画", url: "/bangumi/search", icon: Search },
  ];
}

export function SidebarLayout() {
  const location = useLocation();
  const sidebarItems = getSidebarItems(location.pathname);

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

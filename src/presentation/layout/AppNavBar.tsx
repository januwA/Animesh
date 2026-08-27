import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  CalendarDays,
  Download,
  Heart,
  Search,
  Settings as SettingsIcon,
  Tv,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/presentation/components/ui/dropdown-menu";
import { useTorrentStatus } from "@/presentation/context/TorrentStatusContext";
import { cn } from "@/presentation/lib/utils";

const iconClass =
  "h-5 w-5 md:h-4 md:w-4 transition-transform group-hover/button:scale-110";

const navItemBaseClass = cn(
  "relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-medium transition-all duration-300",
  "md:flex-row md:gap-2 md:px-4 md:py-2.5 md:rounded-xl md:text-sm md:font-semibold",
);

const navItemStateClass = (isActive: boolean) =>
  isActive
    ? "bg-primary/10 text-foreground shadow-none md:bg-primary/15 md:text-primary md:shadow-sm"
    : "text-muted-foreground hover:text-foreground hover:bg-accent/50";

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

const primaryItems: NavItem[] = [
  { path: "/torrent_search", label: "搜索", icon: Search },
  { path: "/bangumi", label: "Bangumi", icon: Calendar },
  { path: "/anilist", label: "AniList", icon: CalendarDays },
  { path: "/collections", label: "收藏", icon: Heart },
  { path: "/downloads", label: "下载", icon: Download },
];

const moreItems: NavItem[] = [
  { path: "/live", label: "直播", icon: Tv },
  { path: "/settings", label: "设置", icon: SettingsIcon },
];

interface NavItemLinkProps {
  item: NavItem;
  isActive: boolean;
  badgeCount?: number;
}

function NavItemLink({ item, isActive, badgeCount = 0 }: NavItemLinkProps) {
  const Icon = item.icon;
  const showBadge = badgeCount > 0;

  return (
    <Link
      to={item.path}
      className={cn(navItemBaseClass, navItemStateClass(isActive))}
    >
      {isActive && (
        <span className="absolute inset-0 bg-primary/10 rounded-xl blur-xs -z-10 md:hidden animate-fade-in" />
      )}
      <Icon className={cn(iconClass, showBadge && "animate-bounce")} />
      <span>{item.label}</span>
      {showBadge && (
        <span className="absolute -top-1 -right-1 md:static md:ml-2 h-4.5 px-1.5 text-[9px] font-extrabold border rounded-full animate-pulse flex items-center justify-center">
          {badgeCount}
        </span>
      )}
    </Link>
  );
}

// 底部导航组件
export function AppNavBar() {
  const location = useLocation();
  const { torrents } = useTorrentStatus();
  const activeCount = torrents.filter((t) => !t.finished && !t.paused).length;
  const isMoreActive = moreItems.some(
    (item) => location.pathname === item.path,
  );

  return (
    <nav
      data-testid="app-navbar"
      className={cn(
        "flex justify-around p-2 rounded-2xl shadow-2xl backdrop-blur-xl fixed bottom-5 left-4 right-4 z-50",
        "bg-card/90 border border-border",
        "md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:w-auto md:justify-center md:gap-1 md:px-2 md:py-1.5 md:rounded-2xl md:shadow-xl md:backdrop-blur-2xl",
      )}
    >
      {primaryItems.map((item) => (
        <NavItemLink
          key={item.path}
          item={item}
          isActive={location.pathname.startsWith(item.path)}
          badgeCount={item.path === "/downloads" ? activeCount : 0}
        />
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="更多"
            className={cn(
              navItemBaseClass,
              navItemStateClass(isMoreActive),
              "cursor-pointer",
            )}
          >
            {isMoreActive && (
              <span className="absolute inset-0 bg-primary/10 rounded-xl blur-xs -z-10 md:hidden animate-fade-in" />
            )}
            <span>更多</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" sideOffset={10}>
          <DropdownMenuGroup>
            {moreItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <DropdownMenuItem key={item.path} asChild>
                  <Link
                    to={item.path}
                    className={cn(
                      "gap-2 cursor-pointer",
                      isActive && "bg-accent text-accent-foreground",
                    )}
                  >
                    <Icon />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}

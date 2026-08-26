import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/presentation/components/ui/tooltip";
import { SidebarLayout } from "./SidebarLayout";

function renderSidebarLayout(initialEntries: string[]) {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route element={<SidebarLayout />}>
            <Route path="calendar" element={<div>日历内容</div>} />
            <Route path="anilist" element={<div>AniList 内容</div>} />
            <Route path="search" element={<div>搜索内容</div>} />
            <Route path="anilist/search" element={<div>AniList 搜索</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  );
}

describe("SidebarLayout 侧边栏布局", () => {
  it("在 /calendar 路由下渲染新番日历和搜索动画菜单项", () => {
    renderSidebarLayout(["/calendar"]);

    expect(screen.getByText("日历内容")).toBeInTheDocument();
    expect(screen.getByText("新番日历")).toBeInTheDocument();
    expect(screen.getByText("搜索动画")).toBeInTheDocument();
  });

  it("在 /anilist 路由下渲染新番日历和搜索动画菜单项", () => {
    renderSidebarLayout(["/anilist"]);

    expect(screen.getByText("AniList 内容")).toBeInTheDocument();
    expect(screen.getByText("新番日历")).toBeInTheDocument();
    expect(screen.getByText("搜索动画")).toBeInTheDocument();
  });

  it("在 /calendar 路由下新番日历链接指向 /calendar", () => {
    renderSidebarLayout(["/calendar"]);

    const links = screen.getAllByRole("link", { name: "新番日历" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/calendar");
  });

  it("在 /anilist 路由下新番日历链接指向 /anilist", () => {
    renderSidebarLayout(["/anilist"]);

    const links = screen.getAllByRole("link", { name: "新番日历" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/anilist");
  });

  it("在 /calendar 路由下搜索动画链接指向 /search", () => {
    renderSidebarLayout(["/calendar"]);

    const links = screen.getAllByRole("link", { name: "搜索动画" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/search");
  });

  it("在 /anilist 路由下搜索动画链接指向 /anilist/search", () => {
    renderSidebarLayout(["/anilist"]);

    const links = screen.getAllByRole("link", { name: "搜索动画" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/anilist/search");
  });

  it("渲染子路由内容", () => {
    renderSidebarLayout(["/search"]);

    expect(screen.getByText("搜索内容")).toBeInTheDocument();
  });
});

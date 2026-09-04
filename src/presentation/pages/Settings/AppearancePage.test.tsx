import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createStoreMock } from "@/test/storeMock";
import AppearancePage from "./AppearancePage";

const { mockSetTheme, mockSetAccent, mockSetShowWallpaper } = vi.hoisted(
  () => ({
    mockSetTheme: vi.fn(),
    mockSetAccent: vi.fn(),
    mockSetShowWallpaper: vi.fn(),
  }),
);

vi.mock("next-themes", () => ({
  useTheme: () => ({ themes: [], theme: undefined, setTheme: mockSetTheme }),
}));

vi.mock(import("@/presentation/hooks/useAccentTheme"), () => ({
  useAccentTheme: () => ({ accent: "indigo", setAccent: mockSetAccent }),
  ACCENT_PRESETS: [
    { id: "indigo", label: "靛蓝", color: "oklch(0.6 0.18 245)" },
    { id: "sky", label: "青蓝", color: "oklch(0.6 0.18 200)" },
    { id: "emerald", label: "翠绿", color: "oklch(0.6 0.18 160)" },
    { id: "rose", label: "玫瑰", color: "oklch(0.6 0.18 355)" },
    { id: "amber", label: "琥珀", color: "oklch(0.6 0.18 85)" },
  ] as const,
}));

vi.mock(import("@/presentation/store/backgroundWallpaperStore"), () => ({
  backgroundWallpaperStore: createStoreMock({
    showWallpaper: true,
    setShowWallpaper: mockSetShowWallpaper,
    reset: vi.fn(),
  }) as typeof import("@/presentation/store/backgroundWallpaperStore").backgroundWallpaperStore,
}));

describe("AppearancePage 外观设置页面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应渲染主题切换选项", () => {
    render(<AppearancePage />);
    expect(screen.getByText("跟随系统")).toBeInTheDocument();
    expect(screen.getByText("浅色模式")).toBeInTheDocument();
    expect(screen.getByText("深色模式")).toBeInTheDocument();
  });

  it("点击浅色模式应调用 setTheme", () => {
    render(<AppearancePage />);
    fireEvent.click(screen.getByText("浅色模式"));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("应渲染主色调选项", () => {
    render(<AppearancePage />);
    expect(screen.getByRole("button", { name: "靛蓝" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "青蓝" })).toBeInTheDocument();
  });

  it("点击主色调按钮应调用 setAccent", () => {
    render(<AppearancePage />);
    fireEvent.click(screen.getByRole("button", { name: "青蓝" }));
    expect(mockSetAccent).toHaveBeenCalledWith("sky");
  });

  it("当前选中的主色调应标记为 pressed", () => {
    render(<AppearancePage />);
    expect(screen.getByRole("button", { name: "靛蓝" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "青蓝" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("应渲染壁纸开关", () => {
    render(<AppearancePage />);
    expect(screen.getByText("显示背景壁纸")).toBeInTheDocument();
  });

  it("切换壁纸开关应调用 setShowWallpaper", () => {
    render(<AppearancePage />);
    const wallpaperSwitch = screen.getByRole("switch", {
      name: "显示背景壁纸",
    });
    fireEvent.click(wallpaperSwitch);
    expect(mockSetShowWallpaper).toHaveBeenCalled();
  });
});

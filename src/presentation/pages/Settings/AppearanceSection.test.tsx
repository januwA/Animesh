import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { AccentId } from "@/presentation/hooks/useAccentTheme";
import { AppearanceSection } from "./AppearanceSection";

const makeProps = (
  overrides: Partial<Parameters<typeof AppearanceSection>[0]> = {},
): Parameters<typeof AppearanceSection>[0] => ({
  theme: "dark",
  onThemeChange: vi.fn(),
  accent: "indigo" as AccentId,
  onAccentChange: vi.fn(),
  showWallpaper: false,
  onShowWallpaperChange: vi.fn(),
  ...overrides,
});

describe("AppearanceSection 外观设置区块", () => {
  it("应该渲染主题切换按钮与主色色块", () => {
    render(<AppearanceSection {...makeProps()} />);

    expect(screen.getByRole("radio", { name: "跟随系统" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "浅色模式" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "深色模式" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "靛蓝" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "青蓝" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "翠绿" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "玫瑰" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "琥珀" })).toBeInTheDocument();
  });

  it("当前主题应该被选中，切换主题时触发 onThemeChange", () => {
    const onThemeChange = vi.fn();
    render(<AppearanceSection {...makeProps({ onThemeChange })} />);

    expect(screen.getByRole("radio", { name: "深色模式" })).toHaveAttribute(
      "data-state",
      "on",
    );

    fireEvent.click(screen.getByRole("radio", { name: "浅色模式" }));

    expect(onThemeChange).toHaveBeenCalledWith("light");
  });

  it("当前主色应该被选中并渲染选中标记", () => {
    render(<AppearanceSection {...makeProps({ accent: "indigo" })} />);

    expect(screen.getByRole("button", { name: "靛蓝" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "青蓝" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("点击主色色块时应该触发 onAccentChange", () => {
    const onAccentChange = vi.fn();
    render(<AppearanceSection {...makeProps({ onAccentChange })} />);

    fireEvent.click(screen.getByRole("button", { name: "玫瑰" }));

    expect(onAccentChange).toHaveBeenCalledWith("rose");
  });

  it("应该显示壁纸开关并在切换时触发回调", () => {
    const onShowWallpaperChange = vi.fn();
    render(
      <AppearanceSection
        {...makeProps({ showWallpaper: true, onShowWallpaperChange })}
      />,
    );

    const wallpaperSwitch = screen.getByRole("switch", {
      name: "显示背景壁纸",
    });
    expect(wallpaperSwitch).toBeChecked();

    fireEvent.click(wallpaperSwitch);

    expect(onShowWallpaperChange).toHaveBeenCalledWith(false);
  });
});

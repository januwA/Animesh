import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { CacheSettingsSection } from "./CacheSettingsSection";

describe("CacheSettingsSection 缓存管理区块", () => {
  it("应该渲染清理缓存按钮", () => {
    const onClearClick = vi.fn();
    render(
      <CacheSettingsSection
        clearingCache={false}
        onClearClick={onClearClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "清理缓存" }));

    expect(onClearClick).toHaveBeenCalled();
  });

  it("清理中时按钮应该被禁用", () => {
    render(
      <CacheSettingsSection clearingCache={true} onClearClick={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "清理缓存" })).toBeDisabled();
  });
});
